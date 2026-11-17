package com.ticketrush.controller;

import com.ticketrush.service.AdminOverviewService;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/overview")
@RequiredArgsConstructor
public class AdminOverviewController {
    private final AdminOverviewService overview;
    @GetMapping public Map<String,Object> get() { return overview.overview(); }
}
