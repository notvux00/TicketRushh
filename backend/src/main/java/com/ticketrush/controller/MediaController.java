package com.ticketrush.controller;

import com.ticketrush.model.dto.MediaUploadRequest;
import com.ticketrush.model.dto.PresignResponse;
import com.ticketrush.service.MediaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/uploads")
@RequiredArgsConstructor
public class MediaController {

    private final MediaService mediaService;

    @PostMapping("/presign")
    public PresignResponse presign(@Valid @RequestBody MediaUploadRequest request,
                                   Authentication authentication) {
        boolean admin = authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
        return mediaService.presign(request, authentication.getName(), admin);
    }
}
