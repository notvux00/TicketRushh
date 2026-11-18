package com.ticketrush.model.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

@Data
public class UserProfileDto {

    @Email(message = "Email không hợp lệ")
    @Size(max = 255)
    private String email;

    @Size(max = 255)
    private String fullName;

    @Size(max = 32)
    private String phoneNumber;

    @Size(max = 20)
    private String gender;

    @Past(message = "Ngày sinh phải ở trong quá khứ")
    private LocalDate dateOfBirth;

    @Size(max = 512)
    private String avatarUrl;
}
