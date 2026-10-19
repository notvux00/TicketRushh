package com.ticketrush.model.dto;

import lombok.Data;
import java.util.ArrayList;
import java.util.List;

@Data
public class EventAnalyticsResponse {
    private Double totalRevenue = 0.0;
    private Long ticketsSold = 0L;
    private Long totalSeats = 0L;
    private Double occupancyRate = 0.0;
    private List<RevenuePoint> revenueTimeline = new ArrayList<>();
    private List<OccupancyByZone> occupancyByZone = new ArrayList<>();
    private List<DemographicSlice> genderDistribution = new ArrayList<>();
    private List<AgeBucket> ageDistribution = new ArrayList<>();

    @Data
    public static class RevenuePoint {
        private String label;
        private Double revenue;

        public RevenuePoint(String label, Double revenue) {
            this.label = label;
            this.revenue = revenue;
        }
    }

    @Data
    public static class OccupancyByZone {
        private String zoneName;
        private Long soldSeats;
        private Long totalSeats;
        private Double occupancyRate;

        public OccupancyByZone(String zoneName, Long soldSeats, Long totalSeats, Double occupancyRate) {
            this.zoneName = zoneName;
            this.soldSeats = soldSeats;
            this.totalSeats = totalSeats;
            this.occupancyRate = occupancyRate;
        }
    }

    @Data
    public static class DemographicSlice {
        private String label;
        private Long value;

        public DemographicSlice(String label, Long value) {
            this.label = label;
            this.value = value;
        }
    }

    @Data
    public static class AgeBucket {
        private String label;
        private Long value;

        public AgeBucket(String label, Long value) {
            this.label = label;
            this.value = value;
        }
    }
}
