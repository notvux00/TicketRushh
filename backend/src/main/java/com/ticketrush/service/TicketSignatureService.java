package com.ticketrush.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.UUID;

@Service
@Slf4j
public class TicketSignatureService {

    static final String PAYLOAD_PREFIX_V1 = "TKRUSH:v1:";
    static final String PAYLOAD_PREFIX_V2 = "TKRUSH:v2:";
    static final String PAYLOAD_PREFIX_V3 = "TKRUSH:v3:";
    private static final long ROTATING_WINDOW_SECONDS = 60;

    private final String secretKey;
    private final String keyVersion;

    public TicketSignatureService(
            @Value("${app.ticket.signing-secret:}") String secretKey,
            @Value("${jwt.secret:}") String jwtSecret,
            @Value("${app.ticket.signing-key-version:1}") String keyVersion,
            @Value("${app.security.allow-insecure-defaults:false}") boolean allowInsecureDefaults) {
        if (secretKey == null || secretKey.isBlank()) {
            throw new IllegalStateException("TICKET_SIGNING_SECRET is required; refusing to start without a ticket signing secret");
        }
        if (secretKey.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("TICKET_SIGNING_SECRET must be at least 32 bytes");
        }
        if (!allowInsecureDefaults && secretKey.equals(jwtSecret)) {
            throw new IllegalStateException("TICKET_SIGNING_SECRET must differ from JWT_SECRET");
        }
        this.secretKey = secretKey;
        this.keyVersion = keyVersion == null || keyVersion.isBlank() ? "1" : keyVersion.trim();
    }

    public record ParsedTicketPayload(
            UUID ticketId,
            UUID seatId,
            String signature,
            String keyVersion,
            boolean validFormat) {
    }

    /**
     * Compute HMAC-SHA256 signature for a specific ticket, seat and key version.
     */
    public String generateSignature(UUID ticketId, UUID seatId) {
        return hmac(keyVersion + ":" + ticketId + ":" + seatId);
    }

    /**
     * Build the current payload: TKRUSH:v2:{keyVersion}:{ticketId}:{seatId}:{signature}
     */
    public String buildPayload(UUID ticketId, UUID seatId) {
        return PAYLOAD_PREFIX_V2 + keyVersion + ":" + ticketId + ":" + seatId + ":" + generateSignature(ticketId, seatId);
    }

    /**
     * Current 60-second window used by short-lived display tokens.
     */
    public long rotatingWindow() {
        return System.currentTimeMillis() / 1000 / ROTATING_WINDOW_SECONDS;
    }

    /**
     * Build a short-lived payload that is valid for the current and previous window.
     * The static v2 payload remains the fallback for printed/downloaded tickets.
     */
    public String buildRotatingPayload(UUID ticketId, UUID seatId, long window) {
        return PAYLOAD_PREFIX_V3 + ticketId + ":" + seatId + ":" + window + ":" + rotatingSignature(ticketId, seatId, window);
    }

    public String buildRotatingPayload(UUID ticketId, UUID seatId) {
        return buildRotatingPayload(ticketId, seatId, rotatingWindow());
    }

    /**
     * Parse and verify either the current v2 payload or the legacy v1 payload.
     */
    public ParsedTicketPayload parseAndVerify(String qrPayload) {
        if (qrPayload == null) {
            return invalid();
        }
        if (qrPayload.startsWith(PAYLOAD_PREFIX_V3)) {
            return verifyV3(qrPayload);
        }
        if (qrPayload.startsWith(PAYLOAD_PREFIX_V2)) {
            return verifyV2(qrPayload);
        }
        if (qrPayload.startsWith(PAYLOAD_PREFIX_V1)) {
            return verifyV1(qrPayload);
        }
        return invalid();
    }

    private ParsedTicketPayload verifyV3(String qrPayload) {
        String[] parts = qrPayload.split(":", 6);
        if (parts.length != 6) {
            return invalid();
        }
        try {
            UUID ticketId = UUID.fromString(parts[2]);
            UUID seatId = UUID.fromString(parts[3]);
            long window = Long.parseLong(parts[4]);
            String signature = parts[5];
            long current = rotatingWindow();
            boolean fresh = window == current || window == current - 1;
            boolean match = constantTimeEquals(rotatingSignature(ticketId, seatId, window), signature);
            return new ParsedTicketPayload(ticketId, seatId, signature, "3", match && fresh);
        } catch (RuntimeException e) {
            log.warn("Invalid rotating ticket QR payload format");
            return invalid();
        }
    }

    private ParsedTicketPayload verifyV2(String qrPayload) {
        String[] parts = qrPayload.split(":", 6);
        if (parts.length != 6) {
            return invalid();
        }
        try {
            String version = parts[2];
            UUID ticketId = UUID.fromString(parts[3]);
            UUID seatId = UUID.fromString(parts[4]);
            String signature = parts[5];
            boolean match = constantTimeEquals(hmac(version + ":" + ticketId + ":" + seatId), signature);
            return new ParsedTicketPayload(ticketId, seatId, signature, version, match);
        } catch (RuntimeException e) {
            log.warn("Invalid ticket QR payload format");
            return invalid();
        }
    }

    private ParsedTicketPayload verifyV1(String qrPayload) {
        // Legacy payloads were signed before key versions existed and used the
        // same secret as JWT. They remain verifiable with the current ticket
        // secret; rotating TICKET_SIGNING_SECRET intentionally invalidates old
        // QR codes and requires reissuing them.
        String[] parts = qrPayload.split(":", 5);
        if (parts.length != 5) {
            return invalid();
        }
        try {
            UUID ticketId = UUID.fromString(parts[2]);
            UUID seatId = UUID.fromString(parts[3]);
            String signature = parts[4];
            boolean match = constantTimeEquals(hmac(ticketId + ":" + seatId), signature);
            return new ParsedTicketPayload(ticketId, seatId, signature, "1", match);
        } catch (RuntimeException e) {
            log.warn("Invalid legacy ticket QR payload format");
            return invalid();
        }
    }

    private ParsedTicketPayload invalid() {
        return new ParsedTicketPayload(null, null, null, null, false);
    }

    private String rotatingSignature(UUID ticketId, UUID seatId, long window) {
        return hmac("3:" + ticketId + ":" + seatId + ":" + window);
    }

    private String hmac(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKeySpec = new SecretKeySpec(secretKey.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(secretKeySpec);
            byte[] hmacBytes = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hmacBytes);
        } catch (Exception e) {
            log.error("Failed to compute ticket HMAC signature", e);
            throw new IllegalStateException("Could not compute ticket signature", e);
        }
    }

    private static boolean constantTimeEquals(String expected, String actual) {
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                actual.getBytes(StandardCharsets.UTF_8));
    }
}
