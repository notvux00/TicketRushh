package com.ticketrush.service;

import org.junit.jupiter.api.Test;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class TicketSignatureServiceTest {

    private static final String JWT_SECRET = "jwt-secret-0123456789-abcdefghijklmnopqrstuvwxyz";
    private static final String TICKET_SECRET = "ticket-secret-0123456789-abcdefghijklmnopqrstuvwxyz";

    private TicketSignatureService service(String version) {
        return new TicketSignatureService(TICKET_SECRET, JWT_SECRET, version, false);
    }

    @Test
    void buildsAndVerifiesCurrentPayload() {
        UUID ticketId = UUID.randomUUID();
        UUID seatId = UUID.randomUUID();

        String payload = service("3").buildPayload(ticketId, seatId);
        var parsed = service("3").parseAndVerify(payload);

        assertTrue(payload.startsWith("TKRUSH:v2:3:"));
        assertTrue(parsed.validFormat());
        assertEquals(ticketId, parsed.ticketId());
        assertEquals(seatId, parsed.seatId());
        assertEquals("3", parsed.keyVersion());
    }

    @Test
    void verifiesLegacyV1PayloadWithTheTicketSecret() throws Exception {
        UUID ticketId = UUID.randomUUID();
        UUID seatId = UUID.randomUUID();
        String legacySignature = hmac(TICKET_SECRET, ticketId + ":" + seatId);

        var parsed = service("2").parseAndVerify("TKRUSH:v1:" + ticketId + ":" + seatId + ":" + legacySignature);

        assertTrue(parsed.validFormat());
        assertEquals(ticketId, parsed.ticketId());
        assertEquals(seatId, parsed.seatId());
        assertEquals("1", parsed.keyVersion());
    }

    @Test
    void buildsAndVerifiesRotatingPayloadForCurrentAndPreviousWindow() {
        UUID ticketId = UUID.randomUUID();
        UUID seatId = UUID.randomUUID();
        long current = service("1").rotatingWindow();

        var currentParsed = service("1").parseAndVerify(service("1").buildRotatingPayload(ticketId, seatId, current));
        var previousParsed = service("1").parseAndVerify(service("1").buildRotatingPayload(ticketId, seatId, current - 1));

        assertTrue(currentParsed.validFormat());
        assertTrue(previousParsed.validFormat());
        assertEquals(ticketId, currentParsed.ticketId());
        assertEquals(seatId, currentParsed.seatId());
    }

    @Test
    void rejectsExpiredOrTamperedRotatingPayload() {
        UUID ticketId = UUID.randomUUID();
        UUID seatId = UUID.randomUUID();
        long expired = service("1").rotatingWindow() - 5;
        String payload = service("1").buildRotatingPayload(ticketId, seatId, expired);

        assertFalse(service("1").parseAndVerify(payload).validFormat());
        assertFalse(service("1").parseAndVerify(payload + "00").validFormat());
    }

    @Test
    void rejectsTamperedPayloads() {
        UUID ticketId = UUID.randomUUID();
        UUID seatId = UUID.randomUUID();
        String payload = service("1").buildPayload(ticketId, seatId);

        assertFalse(service("1").parseAndVerify(payload + "00").validFormat());
        assertFalse(service("1").parseAndVerify("TKRUSH:v2:1:" + ticketId + ":" + UUID.randomUUID()
                + ":" + payload.substring(payload.lastIndexOf(':') + 1)).validFormat());
        assertFalse(service("1").parseAndVerify("not-a-ticket").validFormat());
        assertFalse(service("1").parseAndVerify(null).validFormat());
    }

    @Test
    void rejectsMissingOrShortTicketSecret() {
        assertThrows(IllegalStateException.class,
                () -> new TicketSignatureService("", JWT_SECRET, "1", false));
        assertThrows(IllegalStateException.class,
                () -> new TicketSignatureService("short", JWT_SECRET, "1", false));
    }

    @Test
    void rejectsSharedJwtAndTicketSecretOutsideLocalMode() {
        assertThrows(IllegalStateException.class,
                () -> new TicketSignatureService(TICKET_SECRET, TICKET_SECRET, "1", false));
        assertDoesNotThrow(
                () -> new TicketSignatureService(TICKET_SECRET, TICKET_SECRET, "1", true));
    }

    private static String hmac(String secret, String data) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
    }
}
