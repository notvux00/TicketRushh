package com.ticketrush.controller;

import com.ticketrush.model.dto.CreateVoucherRequest;
import com.ticketrush.service.AdminVoucherService;
import jakarta.validation.Valid;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/vouchers")
@RequiredArgsConstructor
public class AdminVoucherController {
    private final AdminVoucherService vouchers;
    @GetMapping public List<Map<String, Object>> list() { return vouchers.list(); }
    @PostMapping public ResponseEntity<Map<String, Object>> create(@Valid @RequestBody CreateVoucherRequest body, Authentication auth) {
        return ResponseEntity.status(201).body(vouchers.create(body, auth.getName()));
    }
    @PatchMapping("/{id}/toggle") public Map<String, Object> toggle(@PathVariable UUID id) { return vouchers.toggle(id); }
    @DeleteMapping("/{id}") public ResponseEntity<Void> delete(@PathVariable UUID id) {
        vouchers.delete(id); return ResponseEntity.noContent().build();
    }
}
