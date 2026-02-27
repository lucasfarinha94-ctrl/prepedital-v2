/** @type {import('next').NextConfig} */
const nextConfig = {
  // Habilitar Server Actions
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },

  // Imagens externas permitidas
  images: {
    domains: ["lh3.googleusercontent.com"], // avatares do Google
  },

  // Webpack: ignorar módulos Node.js no cliente
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs:     false,
        net:    false,
        tls:    false,
        crypto: false,
      };
    }
    return config;
  },
};

export default nextConfig;
