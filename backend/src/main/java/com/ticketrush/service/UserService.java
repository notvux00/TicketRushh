package com.ticketrush.service;

import com.ticketrush.model.dto.UserProfileDto;
import com.ticketrush.model.entity.User;
import com.ticketrush.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public UserProfileDto getProfile(UUID userId) {
        User user = userRepository.findById(userId).orElse(null);
        
        if (user == null) {
            // Return empty DTO if user doesn't exist in local DB yet
            return new UserProfileDto();
        }

        UserProfileDto dto = new UserProfileDto();
        dto.setEmail(user.getEmail());
        dto.setFullName(user.getFullName());
        dto.setPhoneNumber(user.getPhoneNumber());
        dto.setGender(user.getGender());
        dto.setDateOfBirth(user.getDateOfBirth());
        dto.setAvatarUrl(user.getAvatarUrl());
        return dto;
    }

    @Transactional
    public UserProfileDto updateProfile(UUID userId, String email, UserProfileDto dto) {
        User user = userRepository.findById(userId).orElseGet(() -> {
            // Create user if not exists
            User newUser = new User();
            newUser.setId(userId);
            newUser.setEmail(email);
            newUser.setRole("authenticated");
            return newUser;
        });

        user.setFullName(dto.getFullName());
        user.setPhoneNumber(dto.getPhoneNumber());
        user.setGender(dto.getGender());
        user.setDateOfBirth(dto.getDateOfBirth());
        
        if (dto.getAvatarUrl() != null && !dto.getAvatarUrl().isEmpty()) {
            user.setAvatarUrl(dto.getAvatarUrl());
        }

        userRepository.save(user);

        return getProfile(userId);
    }
}
