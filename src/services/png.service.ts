import type { Request, Response } from "express";
import { trace } from "@opentelemetry/api";
import { Resvg } from "@resvg/resvg-js";
import { traceSync } from "./telemetry.service";

export function isDiscordBot(userAgent: string | undefined): boolean {
  return !!userAgent && /discordbot/i.test(userAgent);
}

export function svgToPng(svg: string): Buffer {
  return traceSync("render.svgToPng", () => {
    const resvg = new Resvg(svg, {
      fitTo: { mode: "original" },
    });
    const rendered = resvg.render();
    const buf = Buffer.from(rendered.asPng());
    trace.getActiveSpan()?.setAttribute("render.output.bytes", buf.length);
    return buf;
  });
}

export function sendImage(
  req: Request,
  res: Response,
  svg: string,
  cacheTtl: number,
  status = 200,
): void {
  const forcePng = req.query.ua === "discord";
  const isPng = forcePng || isDiscordBot(req.headers["user-agent"]);
  const span = trace.getActiveSpan();
  span?.setAttribute("response.format", isPng ? "png" : "svg");
  if (isPng) {
    const png = svgToPng(svg);
    span?.setAttribute("response.bytes", png.length);
    res
      .status(status)
      .set("Content-Type", "image/png")
      .set("Cache-Control", `public, max-age=${cacheTtl / 1000}`)
      .send(png);
  } else {
    span?.setAttribute("response.bytes", Buffer.byteLength(svg, "utf8"));
    res
      .status(status)
      .set("Content-Type", "image/svg+xml")
      .set("Cache-Control", `public, max-age=${cacheTtl / 1000}`)
      .send(svg);
  }
}
