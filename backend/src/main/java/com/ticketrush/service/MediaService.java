package com.ticketrush.service;

import com.ticketrush.model.dto.MediaUploadRequest;
import com.ticketrush.model.dto.PresignResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.time.Duration;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MediaService {

    private static final Set<String> IMAGE_TYPES = Set.of(
            "image/jpeg", "image/png", "image/webp", "image/gif");
    private static final Set<String> VIDEO_TYPES = Set.of(
            "video/mp4", "video/webm");
    private static final Map<String, String> KIND_LABELS = Map.of(
            "avatar", "avatar",
            "event-cover", "event-cover",
            "trailer", "trailer");

    private final S3Presigner s3Presigner;

    @Value("${app.media.bucket:ticketrush-media}")
    private String bucket;

    @Value("${app.media.public-base-url:}")
    private String publicBaseUrl;

    @Value("${app.media.presign-expiry-minutes:10}")
    private long presignExpiryMinutes;

    @Value("${app.media.max-image-bytes:5242880}")
    private long maxImageBytes;

    @Value("${app.media.max-video-bytes:52428800}")
    private long maxVideoBytes;

    public PresignResponse presign(MediaUploadRequest request, String userId, boolean admin) {
        String kind = request.kind().trim().toLowerCase();
        if (!KIND_LABELS.containsKey(kind)) {
            throw new IllegalArgumentException("Unsupported upload kind: " + request.kind());
        }
        if (!"avatar".equals(kind) && !admin) {
            throw new IllegalArgumentException("Only an admin can upload event covers or trailers");
        }

        String contentType = request.contentType().trim().toLowerCase();
        boolean video = "trailer".equals(kind);
        if (video) {
            if (!VIDEO_TYPES.contains(contentType)) {
                throw new IllegalArgumentException("Unsupported video type: " + request.contentType());
            }
            if (request.size() > maxVideoBytes) {
                throw new IllegalArgumentException("Video is too large");
            }
        } else {
            if (!IMAGE_TYPES.contains(contentType)) {
                throw new IllegalArgumentException("Unsupported image type: " + request.contentType());
            }
            if (request.size() > maxImageBytes) {
                throw new IllegalArgumentException("Image is too large");
            }
        }

        String safeName = sanitizeFileName(request.fileName());
        String key = "media/" + kind + "/" + userId + "/" + UUID.randomUUID() + "-" + safeName;

        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(contentType)
                .contentLength(request.size())
                .build();

        Duration expiry = Duration.ofMinutes(presignExpiryMinutes);
        PresignedPutObjectRequest presigned = s3Presigner.presignPutObject(
                PutObjectPresignRequest.builder()
                        .signatureDuration(expiry)
                        .putObjectRequest(putObjectRequest)
                        .build());

        String publicUrl = buildPublicUrl(key);
        return new PresignResponse(presigned.url().toString(), publicUrl, key, expiry.toSeconds());
    }

    private String buildPublicUrl(String key) {
        if (!StringUtils.hasText(publicBaseUrl)) {
            return "/" + key;
        }
        return publicBaseUrl.replaceAll("/+$", "") + "/" + key;
    }

    private String sanitizeFileName(String fileName) {
        String name = fileName.replace("\\", "/");
        int slash = name.lastIndexOf('/');
        if (slash >= 0) {
            name = name.substring(slash + 1);
        }
        name = name.replaceAll("[^A-Za-z0-9._-]", "_");
        if (name.isBlank()) {
            name = "upload";
        }
        return name.length() > 120 ? name.substring(name.length() - 120) : name;
    }
}
