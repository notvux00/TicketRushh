package com.ticketrush.exeption;

import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    private static final String VALIDATION_FAILED = "VALIDATION_FAILED";
    private static final String INVALID_REQUEST = "INVALID_REQUEST";
    private static final String CONFLICT = "CONFLICT";
    private static final String FORBIDDEN = "FORBIDDEN";
    private static final String INTERNAL_ERROR = "INTERNAL_ERROR";

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fields = new LinkedHashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            fields.putIfAbsent(error.getField(), error.getDefaultMessage() == null
                    ? "Invalid value" : error.getDefaultMessage());
        }
        String traceId = traceId();
        log.info("Validation failed traceId={} fields={}", traceId, fields.keySet());
        return ResponseEntity.badRequest()
                .body(new ApiError(VALIDATION_FAILED, "Dữ liệu gửi lên không hợp lệ", fields, traceId));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> handleUnreadable(HttpMessageNotReadableException ex) {
        log.info("Malformed request body: {}", ex.getClass().getSimpleName());
        return ResponseEntity.badRequest()
                .body(ApiError.of(INVALID_REQUEST, "Nội dung yêu cầu không đúng định dạng"));
    }

    @ExceptionHandler({MethodArgumentTypeMismatchException.class, MissingServletRequestParameterException.class})
    public ResponseEntity<ApiError> handleBadParameter(Exception ex) {
        return ResponseEntity.badRequest()
                .body(ApiError.of(INVALID_REQUEST, "Tham số yêu cầu không hợp lệ"));
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiError> handleNotFound(NoResourceFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiError.of("NOT_FOUND", "Không tìm thấy tài nguyên"));
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiError> handleMethodNotAllowed(HttpRequestMethodNotSupportedException ex) {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
                .body(ApiError.of("METHOD_NOT_ALLOWED", "Phương thức HTTP không được hỗ trợ"));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiError> handleStatus(ResponseStatusException ex) {
        String message = ex.getReason() == null ? "Request failed" : ex.getReason();
        String code = ex.getStatusCode().value() == 404 ? "NOT_FOUND" : INVALID_REQUEST;
        return ResponseEntity.status(ex.getStatusCode()).body(ApiError.of(code, message));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiError> handleConflict(DataIntegrityViolationException ex) {
        log.warn("Data integrity violation: {}", ex.getMostSpecificCause().getClass().getSimpleName());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiError.of(
                CONFLICT, "Dữ liệu trùng hoặc đang được sử dụng; vui lòng tải lại và thử lại"));
    }

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<ApiError> handleDataAccess(DataAccessException ex) {
        String traceId = traceId();
        log.error("Database error traceId={}", traceId, ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                ApiError.of(INTERNAL_ERROR, "Không thể xử lý yêu cầu lúc này").withTraceId(traceId));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiError> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiError.of(FORBIDDEN, "Bạn không có quyền thực hiện thao tác này"));
    }

    @ExceptionHandler({IllegalArgumentException.class, IllegalStateException.class})
    public ResponseEntity<ApiError> handleBusiness(RuntimeException ex) {
        String message = safeMessage(ex);
        log.info("Business rule rejected request: {}", message);
        return ResponseEntity.badRequest().body(ApiError.of(INVALID_REQUEST, message));
    }

    // Legacy controllers throw RuntimeException for user-facing business errors.
    // Keep the 400 contract until they are migrated to typed exceptions.
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ApiError> handleRuntimeException(RuntimeException ex) {
        String message = safeMessage(ex);
        log.warn("Request failed: {}", message);
        return ResponseEntity.badRequest().body(ApiError.of(INVALID_REQUEST, message));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleUnexpected(Exception ex) {
        String traceId = traceId();
        log.error("Unhandled error traceId={}", traceId, ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                ApiError.of(INTERNAL_ERROR, "Đã xảy ra lỗi không mong muốn").withTraceId(traceId));
    }

    private static String safeMessage(RuntimeException ex) {
        String message = ex.getMessage();
        return message == null || message.isBlank() ? "Request failed" : message;
    }

    private static String traceId() {
        return UUID.randomUUID().toString().substring(0, 8);
    }
}
