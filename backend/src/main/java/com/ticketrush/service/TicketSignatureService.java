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

    private final String secretKey;

    public TicketSignatureService(@Value("${jwt.secret:TicketRushSuperSecretKeyForJwtSigningMustBeAtLeast256BitsLongTicketRush2026!}") String secretKey) {
        this.secretKey = secretKey;
    }

    public record ParsedTicketPayload(UUID ticketId, UUID seatId, String signature, boolean validFormat) {}

    /**
     * Compute HMAC-SHA256 signature for a specific ticket and seat.
     */
    public String generateSignature(UUID ticketId, UUID seatId) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKeySpec = new SecretKeySpec(secretKey.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(secretKeySpec);
            String data = ticketId.toString() + ":" + seatId.toString();
            byte[] hmacBytes = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hmacBytes);
        } catch (Exception e) {
            log.error("Failed to generate ticket HMAC signature", e);
            throw new RuntimeException("Could not generate ticket signature", e);
        }
    }

    /**
     * Build standard payload: TKRUSH:v1:{ticketId}:{seatId}:{signature}
     */
    public String buildPayload(UUID ticketId, UUID seatId) {
        String signature = generateSignature(ticketId, seatId);
        return "TKRUSH:v1:" + ticketId + ":" + seatId + ":" + signature;
    }

    /**
     * Parse and verify signature from raw QR payload string.
     */
    public ParsedTicketPayload parseAndVerify(String qrPayload) {
        if (qrPayload == null || !qrPayload.startsWith("TKRUSH:v1:")) {
            return new ParsedTicketPayload(null, null, null, false);
        }

        String[] parts = qrPayload.split(":");
        if (parts.length != 5) { // ["TKRUSH", "v1", ticketId, seatId, signature]
            return new ParsedTicketPayload(null, null, null, false);
        }

        try {
            UUID ticketId = UUID.fromString(parts[2]);
            UUID seatId = UUID.fromString(parts[3]);
            String signature = parts[4];

            String expectedSig = generateSignature(ticketId, seatId);
            boolean match = MessageDigest.isEqual(
                    expectedSig.getBytes(StandardCharsets.UTF_8),
                    signature.getBytes(StandardCharsets.UTF_8)
            );

            return new ParsedTicketPayload(ticketId, seatId, signature, match);
        } catch (Exception e) {
            log.warn("Invalid ticket QR payload format: {}", qrPayload);
            return new ParsedTicketPayload(null, null, null, false);
        }
    }
}

