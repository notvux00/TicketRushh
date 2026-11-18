GlobalExceptionHandler xử lý lỗi API theo contract ApiError: ResponseStatusException giữ HTTP status,
MethodArgumentNotValid/ConstraintViolation trả 400 + fieldErrors, DataIntegrityViolation trả 409,
DataAccessException và lỗi không mong đợi trả 500 kèm traceId (không lộ chi tiết DB).
RuntimeException/IllegalArgument/IllegalState của luồng nghiệp vụ cũ vẫn trả 400 để tương thích client.
