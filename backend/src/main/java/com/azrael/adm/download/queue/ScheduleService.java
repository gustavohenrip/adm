package com.azrael.adm.download.queue;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import jakarta.annotation.PostConstruct;

import org.quartz.CronScheduleBuilder;
import org.quartz.Job;
import org.quartz.JobBuilder;
import org.quartz.JobDetail;
import org.quartz.JobExecutionContext;
import org.quartz.JobKey;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.quartz.Trigger;
import org.quartz.TriggerBuilder;
import org.quartz.TriggerKey;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.azrael.adm.persistence.ScheduleRuleEntity;
import com.azrael.adm.persistence.ScheduleRuleRepository;

@Service
public class ScheduleService {

    private static final Logger log = LoggerFactory.getLogger(ScheduleService.class);
    private static final String GROUP = "adm-schedule";

    private final Scheduler scheduler;
    private final ScheduleRuleRepository repo;

    public ScheduleService(Scheduler scheduler, ScheduleRuleRepository repo) {
        this.scheduler = scheduler;
        this.repo = repo;
    }

    @PostConstruct
    public void init() {
        for (ScheduleRuleEntity rule : repo.findByEnabledTrue()) {
            try { register(rule); } catch (Exception e) { log.warn("could not register rule {}: {}", rule.getId(), e.toString()); }
        }
    }

    public void register(ScheduleRuleEntity rule) throws SchedulerException {
        if (rule.getCronStart() != null && !rule.getCronStart().isBlank()) {
            schedule(rule.getId(), "start", rule.getCronStart(), StartAllJob.class);
        }
        if (rule.getCronPause() != null && !rule.getCronPause().isBlank()) {
            schedule(rule.getId(), "pause", rule.getCronPause(), PauseAllJob.class);
        }
    }

    public void unregister(Long ruleId) throws SchedulerException {
        scheduler.deleteJob(JobKey.jobKey("start-" + ruleId, GROUP));
        scheduler.deleteJob(JobKey.jobKey("pause-" + ruleId, GROUP));
    }

    private void schedule(Long ruleId, String kind, String cron, Class<? extends Job> jobClass) throws SchedulerException {
        JobKey jobKey = JobKey.jobKey(kind + "-" + ruleId, GROUP);
        TriggerKey triggerKey = TriggerKey.triggerKey(kind + "-" + ruleId, GROUP);
        scheduler.deleteJob(jobKey);
        JobDetail job = JobBuilder.newJob(jobClass).withIdentity(jobKey).storeDurably().build();
        Trigger trigger = TriggerBuilder.newTrigger()
                .withIdentity(triggerKey)
                .forJob(job)
                .withSchedule(CronScheduleBuilder.cronSchedule(cron))
                .build();
        scheduler.scheduleJob(job, trigger);
    }

    public static class StartAllJob implements Job {
        @Override
        public void execute(JobExecutionContext context) {
            LoggerFactory.getLogger(StartAllJob.class).info("scheduled: resume queue");
        }
    }

    public static class PauseAllJob implements Job {
        @Override
        public void execute(JobExecutionContext context) {
            LoggerFactory.getLogger(PauseAllJob.class).info("scheduled: pause queue");
        }
    }

    public Map<String, Integer> status() {
        Map<String, Integer> m = new HashMap<>();
        try {
            List<String> groups = scheduler.getJobGroupNames();
            m.put("groups", groups.size());
        } catch (SchedulerException e) {
            m.put("groups", -1);
        }
        return m;
    }
}
