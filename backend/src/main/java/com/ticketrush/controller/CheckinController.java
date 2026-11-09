package com.ticketrush.controller;

import com.ticketrush.model.dto.CheckinRequest;
import com.ticketrush.model.dto.CheckinResponse;
import com.ticketrush.service.CheckinService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/checkin")
@RequiredArgsConstructor
public class CheckinController {

    private final CheckinService checkinService;

    @PostMapping("/scan")
    public ResponseEntity<CheckinResponse> scanTicket(
            @Valid @RequestBody CheckinRequest request,
            Authentication authentication) {
        String staffEmail = (authentication != null && authentication.isAuthenticated())
                ? authentication.getName()
                : "Staff";

        CheckinResponse response = checkinService.scanAndCheckIn(request, staffEmail);
        if (!response.isSuccess()) {
            return ResponseEntity.badRequest().body(response);
        }
        return ResponseEntity.ok(response);
    }
}

