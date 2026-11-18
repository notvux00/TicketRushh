package com.ticketrush.service;

import com.ticketrush.repository.TicketRepository;
import com.ticketrush.util.PriceValidation;
import java.time.LocalDateTime;
import com.ticketrush.model.dto.ZonePositionUpdate;
import com.ticketrush.model.dto.ZoneRequest;
import com.ticketrush.model.dto.ZoneResponse;
import com.ticketrush.model.entity.Seat;
import com.ticketrush.model.entity.Showtime;
import com.ticketrush.model.entity.Zone;
import com.ticketrush.repository.SeatRepository;
import com.ticketrush.repository.ShowtimeRepository;
import com.ticketrush.repository.ZoneRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;


@Service
@RequiredArgsConstructor
public class ZoneService {
    private final ZoneRepository zoneRepository;
    private final SeatRepository seatRepository;
    private final ShowtimeRepository showtimeRepository;
    private final TicketRepository ticketRepository;

    @Value("${app.catalog.max-seats-per-zone:5000}")
    private int maxSeatsPerZone;

    @Value("${app.catalog.max-seats-per-request:100000}")
    private int maxSeatsPerRequest;

    // 1. Lấy danh sách Zone theo Showtime
    public List<ZoneResponse> getZonesByShowtime(UUID showtimeId) {
        return zoneRepository.findByShowtimeId(showtimeId).stream().map(zone -> {
            ZoneResponse res = new ZoneResponse();
            res.setId(zone.getId());
            res.setName(zone.getName());
            res.setMatrixRow(zone.getMatrixRow());
            res.setMatrixCol(zone.getMatrixCol());
            res.setPositionX(zone.getPositionX()); // Mới
            res.setPositionY(zone.getPositionY()); // Mới
            res.setVisualWidth(zone.getVisualWidth());
            res.setVisualHeight(zone.getVisualHeight());
            res.setPrice(zone.getPrice());
            return res;
        }).collect(Collectors.toList());
    }

    // 2. Tạo Zone và TỰ ĐỘNG SINH GHẾ
    @Transactional
    public void createZone(UUID showtimeId, ZoneRequest request) {
        PriceValidation.requireValid(request.getPrice());
        requireSeatBudget(request, 1, maxSeatsPerZone);
        Showtime showtime = showtimeRepository.findById(showtimeId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy suất diễn"));

        // Tạo và lưu Zone
        Zone zone = new Zone();
        zone.setName(request.getName());
        zone.setMatrixRow(request.getMatrixRow());
        zone.setMatrixCol(request.getMatrixCol());
        zone.setShowtime(showtime);
        zone.setPrice(request.getPrice());
        zone.setPositionX(request.getPositionX() != null ? request.getPositionX() : 0);
        zone.setPositionY(request.getPositionY() != null ? request.getPositionY() : 0);
        zone.setVisualWidth(request.getVisualWidth() != null ? request.getVisualWidth() : 160);
        zone.setVisualHeight(request.getVisualHeight() != null ? request.getVisualHeight() : 120);
        Zone savedZone = zoneRepository.save(zone);
        seatRepository.saveAll(generateSeats(savedZone, request.getMatrixRow(), request.getMatrixCol()));
    }

    // 2.1. Tạo ĐỒNG LOẠT Zone và Ghế
    @Transactional
    public void createBulkZonesAndSeats(List<Showtime> showtimes, List<ZoneRequest> zoneRequests) {
        if (showtimes == null || showtimes.isEmpty()) {
            return;
        }
        long totalSeats = 0;
        for (ZoneRequest request : zoneRequests) {
            PriceValidation.requireValid(request.getPrice());
            totalSeats += requireSeatBudget(request, showtimes.size(), maxSeatsPerZone);
        }
        if (totalSeats > maxSeatsPerRequest) {
            throw new IllegalArgumentException("Tổng số ghế vượt quá giới hạn " + maxSeatsPerRequest);
        }

        for (Showtime showtime : showtimes) {
            for (ZoneRequest request : zoneRequests) {
                Zone zone = new Zone();
                zone.setName(request.getName());
                zone.setMatrixRow(request.getMatrixRow());
                zone.setMatrixCol(request.getMatrixCol());
                zone.setShowtime(showtime);
                zone.setPrice(request.getPrice());
                zone.setPositionX(request.getPositionX() != null ? request.getPositionX() : 0);
                zone.setPositionY(request.getPositionY() != null ? request.getPositionY() : 0);
                zone.setVisualWidth(request.getVisualWidth() != null ? request.getVisualWidth() : 160);
                zone.setVisualHeight(request.getVisualHeight() != null ? request.getVisualHeight() : 120);
                Zone savedZone = zoneRepository.save(zone);
                seatRepository.saveAll(generateSeats(savedZone, request.getMatrixRow(), request.getMatrixCol()));
            }
        }
        seatRepository.flush();
    }

    @Transactional
    public void deleteZone(UUID zoneId) {
        if (!zoneRepository.existsById(zoneId)) {
            throw new RuntimeException("Khu vực không tồn tại!");
        }
        if (ticketRepository.protectedTicketsForZone(zoneId, LocalDateTime.now()) > 0) {
            throw new IllegalStateException("Cannot delete a zone with issued tickets or active checkouts");
        }
        // Draft tickets from expired checkouts still reference the seats; remove
        // them first, then delete seats in one statement instead of loading the
        // whole collection through CascadeType.ALL.
        ticketRepository.deleteDraftTicketsForZone(zoneId);
        seatRepository.deleteByZoneId(zoneId);
        zoneRepository.deleteById(zoneId);
    }

    // 2. Thêm hàm cập nhật vị trí mới
    @Transactional
    public void updateZonePosition(UUID zoneId, Integer x, Integer y) {
        Zone zone = zoneRepository.findById(zoneId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy khu vực"));
        zone.setPositionX(x);
        zone.setPositionY(y);
        zoneRepository.save(zone);
    }

    @Transactional
    public void updatePositionsByEvent(UUID eventId, List<ZonePositionUpdate> updates) {
        // 1. Lấy tất cả các Suất diễn thuộc Sự kiện này
        List<Showtime> showtimes = showtimeRepository.findByEventId(eventId);
        
        for (Showtime showtime : showtimes) {
            // 2. Lấy tất cả Zone của từng Suất diễn
            List<Zone> zonesInShowtime = zoneRepository.findByShowtimeId(showtime.getId());
            
            for (ZonePositionUpdate update : updates) {
                // 3. Tìm Zone có cùng tên và cập nhật tọa độ
                zonesInShowtime.stream()
                    .filter(z -> z.getName().equalsIgnoreCase(update.getZoneName()))
                    .findFirst()
                    .ifPresent(z -> {
                        z.setPositionX(update.getPositionX());
                        z.setPositionY(update.getPositionY());
                        zoneRepository.save(z);
                    });
            }
        }
    }

    private List<Seat> generateSeats(Zone zone, int rows, int cols) {
        List<Seat> seats = new ArrayList<>(rows * cols);
        for (int r = 1; r <= rows; r++) {
            String rowLabel = rowLabel(r);
            for (int c = 1; c <= cols; c++) {
                Seat seat = new Seat();
                seat.setZone(zone);
                seat.setGridRow(r);
                seat.setGridCol(c);
                seat.setStatus("AVAILABLE");
                seat.setSeatLabel(rowLabel + "-" + c);
                seats.add(seat);
            }
        }
        return seats;
    }

    /**
     * Excel-style row labels: A..Z, AA..AZ, BA.. and so on.
     */
    static String rowLabel(int row) {
        if (row < 1) {
            throw new IllegalArgumentException("Row must be positive");
        }
        StringBuilder label = new StringBuilder();
        int value = row;
        while (value > 0) {
            int remainder = (value - 1) % 26;
            label.insert(0, (char) ('A' + remainder));
            value = (value - 1) / 26;
        }
        return label.toString();
    }

    private static long requireSeatBudget(ZoneRequest request, int copies, int maxSeatsPerZone) {
        if (request.getMatrixRow() == null || request.getMatrixCol() == null) {
            throw new IllegalArgumentException("Số hàng và số cột không được để trống");
        }
        long perZone = (long) request.getMatrixRow() * request.getMatrixCol();
        if (perZone > maxSeatsPerZone) {
            throw new IllegalArgumentException(
                    "Khu vực vượt quá giới hạn " + maxSeatsPerZone + " ghế");
        }
        return perZone * copies;
    }
}
