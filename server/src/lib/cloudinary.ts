
import { v2 as cloudinary } from "cloudinary";
import { ValidationError } from "../types/app-error.js";

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

/** Normalized result returned after a successful Cloudinary upload. */
export type CloudinaryUploadResult = {
    secureUrl: string;
    publicId: string;
    bytes: number;
    originalFilename: string;
    resourceType: "raw" | "image";
};

/**
 * Applies the Cloudinary SDK credentials.
 *
 * @returns True when all three credentials are present
 */
function configureCloudinary() {
    if (!cloudName || !apiKey || !apiSecret) {
        return false;
    }

    cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
    });

    return true;
}

export function getSignedCloudinaryDownloadUrl(
    publicId: string,
    resourceType: "raw" | "image" = "raw",
) {
    if (!configureCloudinary()) {
        return null;
    }

    return cloudinary.url(publicId, {
        resource_type: resourceType,
        type: "upload",
        sign_url: true,
        secure: true,
    });
}

/**
 * Uploads a PDF buffer to Cloudinary as a signed `raw` upload.
 *
 * The stored public id deliberately drops the `.pdf` extension: Cloudinary
 * accounts with "Allow delivery of PDF and ZIP files" turned off return 401 for
 * any URL ending in `.pdf`, even signed ones. Extensionless raw assets are
 * delivered normally, and the file is served back to users through
 * `GET /sources/:sourceId/file`, which restores the PDF headers.
 *
 * @param buffer - PDF file bytes from Multer
 * @param filename - Original filename (used as the public id base)
 * @returns Upload metadata including secure URL and public id
 * @throws {ValidationError} When Cloudinary is not configured or upload is rejected
 *
 */
export async function uploadPdfToCloudinary(
    buffer: Buffer,
    filename: string,
): Promise<CloudinaryUploadResult> {
    if (!configureCloudinary()) {
        throw new ValidationError(
            "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in server/.env.",
        );
    }

    const result = await new Promise<Record<string, unknown>>(
        (resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    resource_type: "raw",
                    folder: "chaibook/pdfs",
                    access_mode: "public",
                    use_filename: true,
                    unique_filename: true,
                    filename_override: filename.replace(/\.pdf$/i, ""),
                },
                (error, uploaded) => {
                    if (error || !uploaded) {
                        reject(error ?? new Error("Cloudinary upload failed"));
                        return;
                    }

                    resolve(uploaded as unknown as Record<string, unknown>);
                },
            );

            stream.end(buffer);
        },
    ).catch((error: Error & { http_code?: number }) => {
        console.error("[cloudinary] PDF upload failed", error);

        if (error.http_code === 401) {
            throw new ValidationError(
                "Cloudinary rejected the credentials. Check CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in server/.env.",
            );
        }

        if (error.http_code === 403) {
            throw new ValidationError(
                "Cloudinary rejected the upload: this API key is missing Upload permission. In Cloudinary Dashboard → Settings → API Keys, enable Upload for the key.",
            );
        }

        throw new ValidationError(
            error.message || "Cloudinary upload failed",
        );
    });

    return {
        secureUrl: String(result.secure_url),
        publicId: String(result.public_id),
        bytes: Number(result.bytes),
        originalFilename: filename,
        resourceType: result.resource_type === "image" ? "image" : "raw",
    };
}
