/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["bcryptjs", "qrcode"],
};

export default nextConfig;
