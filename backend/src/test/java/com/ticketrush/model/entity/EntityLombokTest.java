package com.ticketrush.model.entity;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class EntityLombokTest {

    @Test
    void userEqualityUsesIdAndDoesNotPrintPassword() {
        UUID id = UUID.randomUUID();
        User user = User.builder().id(id).email("a@example.com").password("super-secret").build();
        User sameId = User.builder().id(id).email("other@example.com").build();

        assertEquals(user, sameId);
        assertEquals(user.hashCode(), sameId.hashCode());
        assertFalse(user.toString().contains("super-secret"));
    }

    @Test
    void bidirectionalAssociationsDoNotRecurseInToString() {
        Event event = new Event();
        event.setId(UUID.randomUUID());
        Showtime showtime = new Showtime();
        showtime.setId(UUID.randomUUID());
        showtime.setEvent(event);
        event.setShowtimes(List.of(showtime));

        Zone zone = new Zone();
        zone.setId(UUID.randomUUID());
        zone.setShowtime(showtime);
        showtime.setZones(List.of(zone));

        assertDoesNotThrow(event::toString);
        assertDoesNotThrow(showtime::toString);
        assertDoesNotThrow(zone::toString);
    }
}
