package com.ticketrush.service;

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

        // LOGIC TỰ ĐỘNG SINH GHẾ (Auto-generate Seats)
        List<Seat> seats = new ArrayList<>();
        for (int r = 1; r <= request.getMatrixRow(); r++) {
            for (int c = 1; c <= request.getMatrixCol(); c++) {
                Seat seat = new Seat();
                seat.setZone(savedZone);
                seat.setGridRow(r);
                seat.setGridCol(c);
                seat.setStatus("AVAILABLE"); // Mặc định là ghế trống

                // Tạo nhãn tự động (Ví dụ: A-1, B-2)
                String rowLabel = String.valueOf((char) ('A' + r - 1));
                seat.setSeatLabel(rowLabel + "-" + c);
                seats.add(seat);
            }
        }
        seatRepository.saveAll(seats); // Lưu hàng loạt ghế vào Database
    }

    // 2.1. Tạo ĐỒNG LOẠT Zone và Ghế
    @Transactional
    public void createBulkZonesAndSeats(List<Showtime> showtimes, List<ZoneRequest> zoneRequests) {
        if (showtimes == null || showtimes.isEmpty()) {
            return;
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

                List<Seat> seats = new ArrayList<>();
                for (int r = 1; r <= request.getMatrixRow(); r++) {
                    for (int c = 1; c <= request.getMatrixCol(); c++) {
                        Seat seat = new Seat();
                        seat.setZone(savedZone);
                        seat.setGridRow(r);
                        seat.setGridCol(c);
                        seat.setStatus("AVAILABLE");
                        String rowLabel = String.valueOf((char) ('A' + r - 1));
                        seat.setSeatLabel(rowLabel + "-" + c);
                        seats.add(seat);
                    }
                }
                seatRepository.saveAll(seats);
            }
        }
        seatRepository.flush();
    }

    @Transactional
    public void deleteZone(UUID zoneId) {
        if (!zoneRepository.existsById(zoneId)) {
            throw new RuntimeException("Khu vực không tồn tại!");
        }
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
}
