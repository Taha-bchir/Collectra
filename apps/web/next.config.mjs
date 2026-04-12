process.env.BASELINE_BROWSER_MAPPING_IGNORE_OLD_DATA = 'true'

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'xchaqrowgrggzinvozem.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;