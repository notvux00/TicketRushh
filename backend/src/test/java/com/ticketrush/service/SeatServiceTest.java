package com.ticketrush.service;

import com.ticketrush.model.dto.ShowtimeSeatResponse;
import com.ticketrush.model.entity.Seat;
import com.ticketrush.model.entity.Zone;
import com.ticketrush.repository.SeatRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SeatServiceTest {

    @Mock
    private SeatRepository seatRepository;
    @Mock
    private SeatLockService seatLockService;

    @InjectMocks
    private SeatService seatService;

    private UUID showtimeId;
    private Zone vipZone;
    private Zone standardZone;
    private Seat vipSeat;
    private Seat lockedByOther;
    private Seat lockedByMe;
    private Seat soldSeat;

    @BeforeEach
    void setUp() {
        showtimeId = UUID.randomUUID();

        vipZone = new Zone();
        vipZone.setId(UUID.randomUUID());
        vipZone.setName("VIP");
        vipZone.setPrice(250_000.0);

        standardZone = new Zone();
        standardZone.setId(UUID.randomUUID());
        standardZone.setName("Standard");
        standardZone.setPrice(120_000.0);

        vipSeat = seat("A1", 1, 1, "AVAILABLE", vipZone);
        lockedByOther = seat("A2", 1, 2, "AVAILABLE", vipZone);
        lockedByMe = seat("B1", 2, 1, "AVAILABLE", standardZone);
        soldSeat = seat("B2", 2, 2, "SOLD", standardZone);
    }

    private Seat seat(String label, int row, int col, String status, Zone zone) {
        Seat seat = new Seat();
        seat.setId(UUID.randomUUID());
        seat.setSeatLabel(label);
        seat.setGridRow(row);
        seat.setGridCol(col);
        seat.setStatus(status);
        seat.setZone(zone);
        return seat;
    }

    @Test
    void returnsEverySeatOfShowtimeWithZoneAndLockState() {
        when(seatRepository.findByShowtimeIdForBooking(showtimeId))
                .thenReturn(List.of(vipSeat, lockedByOther, lockedByMe, soldSeat));
        when(seatLockService.getLockedSeatsInfo(eq(showtimeId), anyList()))
                .thenReturn(Map.of(
                        lockedByOther.getId(), "other-user",
                        lockedByMe.getId(), "user-1",
                        soldSeat.getId(), "user-1"));
        when(seatLockService.isOwnedByUser("user-1", "user-1")).thenReturn(true);
        when(seatLockService.isOwnedByUser("other-user", "user-1")).thenReturn(false);

        List<ShowtimeSeatResponse> result = seatService.getSeatsByShowtimeForBooking(showtimeId, "user-1");

        assertEquals(4, result.size());
        assertEquals(vipZone.getId(), result.get(0).getZoneId());
        assertEquals("VIP", result.get(0).getZoneName());
        assertEquals(250_000.0, result.get(0).getPrice());
        assertEquals("AVAILABLE", result.get(0).getStatus());

        ShowtimeSeatResponse other = result.get(1);
        assertEquals("LOCKED", other.getStatus());
        assertFalse(other.isLockedByMe());

        ShowtimeSeatResponse mine = result.get(2);
        assertEquals("LOCKED", mine.getStatus());
        assertTrue(mine.isLockedByMe());
        assertEquals(standardZone.getId(), mine.getZoneId());

        ShowtimeSeatResponse sold = result.get(3);
        assertEquals("SOLD", sold.getStatus());
        assertTrue(sold.isLockedByMe());
    }
}
