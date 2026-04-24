package com.opendownloader.odm.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "schedule_rules")
public class ScheduleRuleEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "cron_start", length = 64)
    private String cronStart;

    @Column(name = "cron_pause", length = 64)
    private String cronPause;

    @Column(name = "enabled", nullable = false)
    private boolean enabled;

    @Column(name = "label", length = 128)
    private String label;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getCronStart() { return cronStart; }
    public void setCronStart(String cronStart) { this.cronStart = cronStart; }
    public String getCronPause() { return cronPause; }
    public void setCronPause(String cronPause) { this.cronPause = cronPause; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
}
