const suspiciousProbeFilePattern =
  /^\/(?:config|aws-config|aws\.config)\.(?:json|js|php)(?:$|\/)/;
const suspiciousProbeExtensionPattern = /\.(?:php|bak|old|save|tmp)(?:$|\/)/;

function pathnameVariants(pathname: string) {
  const variants = new Set([pathname.toLowerCase()]);

  try {
    variants.add(decodeURIComponent(pathname).toLowerCase());
  } catch {
    // Malformed encodings are left for Next to handle normally.
  }

  return variants;
}

function hasBlockedDotSegment(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);

  return segments.some((segment, index) => {
    if (!segment.startsWith(".")) return false;
    return !(index === 0 && segment === ".well-known");
  });
}

export function isSuspiciousProbePath(pathname: string) {
  for (const path of pathnameVariants(pathname)) {
    if (hasBlockedDotSegment(path)) return true;
    if (path.includes("/_next/static/") && path.includes('"')) return true;
    if (path.includes("/wp-config") || path.includes("/phpinfo")) return true;
    if (path.includes("/aws-config") || path.includes("/aws.config")) {
      return true;
    }
    if (suspiciousProbeFilePattern.test(path)) return true;
    if (suspiciousProbeExtensionPattern.test(path)) return true;
  }

  return false;
}
