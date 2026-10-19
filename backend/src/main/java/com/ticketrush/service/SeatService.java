package com.ticketrush.service;

import com.ticketrush.model.dto.SeatBulkUpdateRequest;
import com.ticketrush.model.dto.SeatResponse;
import com.ticketrush.model.entity.Seat;
import com.ticketrush.repository.SeatRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SeatService {
    private final SeatRepository seatRepository;
    private final SeatLockService seatLockService;

    @Transactional(readOnly = true)
    public List<SeatResponse> getSeatsByZone(UUID zoneId, String userId) {
        return seatRepository.findByZoneIdOrderByGridRowAscGridColAsc(zoneId).stream().map(seat -> {
            SeatResponse res = new SeatResponse();
            res.setId(seat.getId());
            res.setSeatLabel(seat.getSeatLabel());
            UUID showtimeId = seat.getZone().getShowtime().getId();
            
            boolean isLocked = seatLockService.isSeatLocked(showtimeId, seat.getId());
            boolean lockedByMe = false;
            
            if (isLocked && userId != null) {
                lockedByMe = seatLockService.isLockedByUser(showtimeId, seat.getId(), userId);
            }
            
            if (!"SOLD".equalsIgnoreCase(seat.getStatus()) && isLocked) {
                res.setStatus("LOCKED");
            } else {
                res.setStatus(seat.getStatus());
            }
            res.setGridRow(seat.getGridRow());
            res.setGridCol(seat.getGridCol());
            res.setLockedByMe(lockedByMe);
            return res;
        }).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<SeatResponse> getSeatsByZoneForBooking(UUID zoneId, String userId) {
        List<Seat> seats = seatRepository.findByZoneIdForBooking(zoneId);
        if (seats.isEmpty()) return List.of();

        UUID showtimeId = seats.get(0).getZone().getShowtime().getId();
        List<UUID> seatIds = seats.stream().map(Seat::getId).collect(Collectors.toList());
        
        java.util.Map<UUID, String> lockedSeatsInfo = seatLockService.getLockedSeatsInfo(showtimeId, seatIds);

        return seats.stream().map(seat -> {
            SeatResponse res = new SeatResponse();
            res.setId(seat.getId());
            res.setSeatLabel(seat.getSeatLabel());
            
            String locker = lockedSeatsInfo.get(seat.getId());
            boolean isLocked = locker != null;
            boolean lockedByMe = isLocked && userId != null && seatLockService.isOwnedByUser(locker, userId);
            
            if (!"SOLD".equalsIgnoreCase(seat.getStatus()) && isLocked) {
                res.setStatus("LOCKED");
            } else {
                res.setStatus(seat.getStatus());
            }
            res.setGridRow(seat.getGridRow());
            res.setGridCol(seat.getGridCol());
            res.setLockedByMe(lockedByMe);
            return res;
        }).collect(Collectors.toList());
    }

    @Transactional
    public void updateSeatsStatus(SeatBulkUpdateRequest request) {
        List<Seat> seats = seatRepository.findAllById(request.getSeatIds());
        for (Seat seat : seats) {
            seat.setStatus(request.getStatus());
        }
        seatRepository.saveAll(seats);
    }
}
