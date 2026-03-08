import type { Request, Response } from "express";
import { Resvg } from "@resvg/resvg-js";

export function isDiscordBot(userAgent: string | undefined): boolean {
  return !!userAgent && /discordbot/i.test(userAgent);
}

export function svgToPng(svg: string): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "original" },
  });
  const rendered = resvg.render();
  return Buffer.from(rendered.asPng());
}

/**
 * Send an SVG (or PNG for Discord bots) response.
 */
export function sendImage(
  req: Request,
  res: Response,
  svg: string,
  cacheTtl: number,
  status = 200,
): void {
  const forcePng = req.query.ua === "discord";
  if (forcePng || isDiscordBot(req.headers["user-agent"])) {
    const png = svgToPng(svg);
    res
      .status(status)
      .set("Content-Type", "image/png")
      .set("Cache-Control", `public, max-age=${cacheTtl / 1000}`)
      .send(png);
  } else {
    res
      .status(status)
      .set("Content-Type", "image/svg+xml")
      .set("Cache-Control", `public, max-age=${cacheTtl / 1000}`)
      .send(svg);
  }
}
