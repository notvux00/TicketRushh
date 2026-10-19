package com.ticketrush.controller;

import com.ticketrush.model.dto.UserProfileDto;
import com.ticketrush.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping
    public ResponseEntity<UserProfileDto> getProfile(@AuthenticationPrincipal Jwt jwt) {
        UUID userId = UUID.fromString(jwt.getSubject());
        
        UserProfileDto profile = userService.getProfile(userId);
        
        // If DB doesn't have it, fill basic info from JWT
        if (profile.getEmail() == null) {
            profile.setEmail(jwt.getClaimAsString("email"));
            
            // Supabase stores user_metadata in the token sometimes
            if (jwt.getClaims().containsKey("user_metadata")) {
                java.util.Map<String, Object> meta = jwt.getClaimAsMap("user_metadata");
                if (meta.containsKey("full_name")) profile.setFullName((String) meta.get("full_name"));
            }
        }
        
        return ResponseEntity.ok(profile);
    }

    @PutMapping
    public ResponseEntity<UserProfileDto> updateProfile(@AuthenticationPrincipal Jwt jwt, @RequestBody UserProfileDto dto) {
        UUID userId = UUID.fromString(jwt.getSubject());
        String email = jwt.getClaimAsString("email");
        
        UserProfileDto updatedProfile = userService.updateProfile(userId, email, dto);
        return ResponseEntity.ok(updatedProfile);
    }
}
