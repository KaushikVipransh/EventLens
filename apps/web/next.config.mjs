/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Presigned photo URLs are rendered with plain <img>, so no remote image config needed.
  // Type-safety is enforced via `npm run typecheck`; skip ESLint in the build
  // (the Next ESLint plugin isn't installed and lint isn't build-critical here).
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
