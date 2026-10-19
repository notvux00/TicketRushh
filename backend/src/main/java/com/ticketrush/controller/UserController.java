package com.ticketrush.controller;

import com.ticketrush.model.dto.UserProfileDto;
import com.ticketrush.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping
    public ResponseEntity<UserProfileDto> getProfile(Authentication authentication) {
        UUID userId = UUID.fromString(authentication.getName());
        UserProfileDto profile = userService.getProfile(userId);
        return ResponseEntity.ok(profile);
    }

    @PutMapping
    public ResponseEntity<UserProfileDto> updateProfile(Authentication authentication, @RequestBody UserProfileDto dto) {
        UUID userId = UUID.fromString(authentication.getName());
        UserProfileDto updatedProfile = userService.updateProfile(userId, dto.getEmail(), dto);
        return ResponseEntity.ok(updatedProfile);
    }
}
