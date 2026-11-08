/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  // The panelists' "brains" are read from disk at runtime, so ship them with the server functions.
  outputFileTracingIncludes: {
    "/api/analysis/**": ["./brains/analysis/**/*"],
    "/api/avatars": ["./public/avatars/**/*"],
  },
};
