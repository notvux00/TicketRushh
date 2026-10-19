package com.ticketrush.model.dto;

import lombok.Data;
import java.time.LocalDate;

@Data
public class UserProfileDto {
    private String email;
    private String fullName;
    private String phoneNumber;
    private String gender;
    private LocalDate dateOfBirth;
    private String avatarUrl;
}
