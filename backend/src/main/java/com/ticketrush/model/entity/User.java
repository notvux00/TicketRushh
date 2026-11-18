package com.ticketrush.model.entity;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

@Entity
@Table(name = "users")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@ToString(exclude = {"orders", "password"})
public class User {
    @Id
    @EqualsAndHashCode.Include
    private UUID id;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(nullable = false)
    private String password;

    private String fullName;

    @Builder.Default
    private String role = "USER"; // "USER" or "ADMIN"

    private String gender;
    private LocalDate dateOfBirth;
    private String avatarUrl;
    private String phoneNumber;

    @OneToMany(mappedBy = "user")
    private List<Order> orders;

    @PrePersist
    public void prePersist() {
        if (this.id == null) {
            this.id = UUID.randomUUID();
        }
        if (this.role == null) {
            this.role = "USER";
        }
    }
}
