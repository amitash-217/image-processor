import express from "express";
import multer from "multer";
import sharp from "sharp";
import { Client } from "minio";
import { randomUUID } from "crypto";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const minio = new Client({
    endPoint: process.env.MINIO_ENDPOINT,
    port: Number(process.env.MINIO_PORT),
    useSSL: process.env.MINIO_SSL === "true",
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
});

const BUCKET = process.env.MINIO_BUCKET;

app.post(
    "/upload",
    upload.single("image"),
    async (req, res) => {
        try {
            const downloadUrlReq = req.query.download == "true"
            if (!req.file) {
                return res.status(400).json({
                    error: "No image uploaded",
                });
            }

            const compressed = await sharp(req.file.buffer)
                .rotate()
                .avif({
                    quality: 90,
                    effort: 6,
                })
                .toBuffer();

            const objectKey = `${randomUUID()}.avif`;

            await minio.putObject(
                BUCKET,
                objectKey,
                compressed,
                compressed.length,
                {
                    "Content-Type": "image/avif",
                }
            );

            if (downloadUrlReq) {
                const downloadUrl = await minio.presignedGetObject(BUCKET, objectKey, 3600);

                res.json({
                    success: true,
                    downloadUrl,
                });
            } else {
                res.json({
                    success: true,
                    objectKey,
                });
            }
        } catch (err) {
            console.error(err);

            res.status(500).json({
                error: "Failed to process image",
            });
        }
    }
);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});