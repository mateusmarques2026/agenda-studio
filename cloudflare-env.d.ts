declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    STUDIO_ADMIN_EMAIL?: string;
    STUDIO_LOCAL_PREVIEW?: string;
    BUCKET?: R2Bucket;
  }
}
