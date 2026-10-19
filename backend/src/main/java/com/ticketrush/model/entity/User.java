package com.ticketrush.model.entity;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "users")
@Data
public class User {
    @Id 
    private UUID id;

    @Column(unique = true, nullable = false)
    private String email;

    private String fullName;
    private String role; 
    private String gender;
    private LocalDate dateOfBirth;
    private String avatarUrl;
    private String phoneNumber;

    @OneToMany(mappedBy = "user")
    private List<Order> orders;
}