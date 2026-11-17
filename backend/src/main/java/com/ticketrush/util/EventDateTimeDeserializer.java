package com.ticketrush.util;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.deser.std.StdDeserializer;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;

/** Accept venue-local form inputs and normalize explicit offsets to venue time. */
public class EventDateTimeDeserializer extends StdDeserializer<LocalDateTime> {
    public EventDateTimeDeserializer() {
        super(LocalDateTime.class);
    }

    @Override
    public LocalDateTime deserialize(JsonParser parser, DeserializationContext context) throws IOException {
        String value = parser.getText();
        try {
            return OffsetDateTime.parse(value).atZoneSameInstant(EventTime.ZONE).toLocalDateTime();
        } catch (DateTimeParseException ignored) {
            try {
                return LocalDateTime.parse(value);
            } catch (DateTimeParseException invalid) {
                return (LocalDateTime) context.handleWeirdStringValue(LocalDateTime.class, value,
                        "Expected an ISO local or offset date-time");
            }
        }
    }
}
