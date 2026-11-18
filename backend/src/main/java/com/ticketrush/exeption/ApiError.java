package com.ticketrush.exeption;

import java.util.Map;

/**
 * Stable error contract returned by the API. Clients should branch on
 * {@code code}, not on localized {@code message} text.
 */
public record ApiError(String code, String message, Map<String, String> fieldErrors, String traceId) {

    public static ApiError of(String code, String message) {
        return new ApiError(code, message, null, null);
    }

    public ApiError withTraceId(String traceId) {
        return new ApiError(code, message, fieldErrors, traceId);
    }
}
