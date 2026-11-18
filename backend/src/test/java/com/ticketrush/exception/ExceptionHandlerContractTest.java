package com.ticketrush.exception;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ExceptionHandlerContractTest {

    @Test
    void nullMessageStillReturnsAValidErrorBody() {
        var response = new GlobalExceptionHandler().handleRuntimeException(new RuntimeException());
        assertEquals(400, response.getStatusCode().value());
        assertNotNull(response.getBody());
        assertEquals("INVALID_REQUEST", response.getBody().code());
        assertEquals("Request failed", response.getBody().message());
    }

    @Test
    void unexpectedErrorsDoNotLeakTheExceptionMessage() {
        var response = new GlobalExceptionHandler().handleUnexpected(new IllegalStateException("jdbc:secret"));
        assertEquals(500, response.getStatusCode().value());
        assertNotNull(response.getBody());
        assertEquals("INTERNAL_ERROR", response.getBody().code());
        assertFalse(response.getBody().message().contains("jdbc:secret"));
        assertNotNull(response.getBody().traceId());
    }
}
