import type { CookieOptions, Request } from "express";
import { ENV } from "./env";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  // const hostname = req.hostname;
  // const shouldSetDomain =
  //   hostname &&
  //   !LOCAL_HOSTS.has(hostname) &&
  //   !isIpAddress(hostname) &&
  //   hostname !== "127.0.0.1" &&
  //   hostname !== "::1";

  // const domain =
  //   shouldSetDomain && !hostname.startsWith(".")
  //     ? `.${hostname}`
  //     : shouldSetDomain
  //       ? hostname
  //       : undefined;

  // Plattform-Betrieb (Manus-OAuth, App läuft im iframe): SameSite=None ist
  // nötig, damit der Cookie im eingebetteten Kontext mitgeschickt wird.
  //
  // Self-Hosting (lokaler Login, eigene Domain): SameSite=Lax. Wichtig, weil
  // SameSite=None zwingend das Secure-Flag verlangt – und hinter einem Proxy,
  // der kein X-Forwarded-Proto setzt, wird Secure hier false. Den Cookie
  // "None ohne Secure" verwirft jeder moderne Browser stillschweigend; das
  // Symptom ist eine Login-Schleife (Anmeldung ok, Session hält nie).
  const eingebettet = Boolean(ENV.oAuthServerUrl);

  return {
    httpOnly: true,
    path: "/",
    sameSite: eingebettet ? "none" : "lax",
    secure: isSecureRequest(req),
  };
}
