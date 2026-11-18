package com.ticketrush.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ZoneServiceTest {

    @Test
    void rowLabelsSupportBeyondTwentySixRows() {
        assertEquals("A", ZoneService.rowLabel(1));
        assertEquals("Z", ZoneService.rowLabel(26));
        assertEquals("AA", ZoneService.rowLabel(27));
        assertEquals("AZ", ZoneService.rowLabel(52));
        assertEquals("BA", ZoneService.rowLabel(53));
        assertEquals("ZZ", ZoneService.rowLabel(702));
        assertEquals("AAA", ZoneService.rowLabel(703));
    }

    @Test
    void rowLabelsRejectNonPositiveValues() {
        assertThrows(IllegalArgumentException.class, () -> ZoneService.rowLabel(0));
        assertThrows(IllegalArgumentException.class, () -> ZoneService.rowLabel(-1));
    }
}
