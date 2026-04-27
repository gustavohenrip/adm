package com.opendownloader.odm.api;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.opendownloader.odm.download.queue.ScheduleService;
import com.opendownloader.odm.persistence.ScheduleRuleEntity;

@RestController
@RequestMapping("/api/schedule")
public class ScheduleController {

    private final ScheduleService schedule;

    public ScheduleController(ScheduleService schedule) {
        this.schedule = schedule;
    }

    @GetMapping("/rules")
    public List<ScheduleRuleEntity> list() {
        return schedule.rules();
    }

    @PostMapping("/rules")
    public ResponseEntity<ScheduleRuleEntity> create(@RequestBody ScheduleRuleEntity rule) throws Exception {
        rule.setId(null);
        return ResponseEntity.ok(schedule.save(rule));
    }

    @PutMapping("/rules/{id}")
    public ResponseEntity<ScheduleRuleEntity> update(@PathVariable Long id, @RequestBody ScheduleRuleEntity rule) throws Exception {
        rule.setId(id);
        return ResponseEntity.ok(schedule.save(rule));
    }

    @DeleteMapping("/rules/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) throws Exception {
        schedule.delete(id);
        return ResponseEntity.noContent().build();
    }
}
