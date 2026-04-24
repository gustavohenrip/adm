package com.opendownloader.odm.persistence;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ScheduleRuleRepository extends JpaRepository<ScheduleRuleEntity, Long> {
    List<ScheduleRuleEntity> findByEnabledTrue();
}
