package com.opendownloader.odm.download.queue;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import jakarta.annotation.PostConstruct;

import org.quartz.CronScheduleBuilder;
import org.quartz.Job;
import org.quartz.JobBuilder;
import org.quartz.JobDataMap;
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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Service;

import com.opendownloader.odm.download.DownloadService;
import com.opendownloader.odm.persistence.ScheduleRuleEntity;
import com.opendownloader.odm.persistence.ScheduleRuleRepository;

@Service
public class ScheduleService {

    private static final Logger log = LoggerFactory.getLogger(ScheduleService.class);
    private static final String GROUP = "odm-schedule";

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

    public List<ScheduleRuleEntity> rules() { return repo.findAll(); }

    public ScheduleRuleEntity save(ScheduleRuleEntity rule) throws SchedulerException {
        ScheduleRuleEntity saved = repo.save(rule);
        unregister(saved.getId());
        if (saved.isEnabled()) register(saved);
        return saved;
    }

    public void delete(Long id) throws SchedulerException {
        unregister(id);
        repo.deleteById(id);
    }

    public void register(ScheduleRuleEntity rule) throws SchedulerException {
        if (rule.getCronStart() != null && !rule.getCronStart().isBlank()) {
            schedule(rule.getId(), "start", rule.getCronStart(), StartAllJob.class, rule);
        }
        if (rule.getCronPause() != null && !rule.getCronPause().isBlank()) {
            schedule(rule.getId(), "pause", rule.getCronPause(), PauseAllJob.class, rule);
        }
    }

    public void unregister(Long ruleId) throws SchedulerException {
        scheduler.deleteJob(JobKey.jobKey("start-" + ruleId, GROUP));
        scheduler.deleteJob(JobKey.jobKey("pause-" + ruleId, GROUP));
    }

    private void schedule(Long ruleId, String kind, String cron, Class<? extends Job> jobClass, ScheduleRuleEntity rule) throws SchedulerException {
        JobKey jobKey = JobKey.jobKey(kind + "-" + ruleId, GROUP);
        TriggerKey triggerKey = TriggerKey.triggerKey(kind + "-" + ruleId, GROUP);
        scheduler.deleteJob(jobKey);
        JobDataMap data = new JobDataMap();
        data.put("ruleId", ruleId);
        data.put("shutdownAfter", rule.isShutdownAfter());
        if (rule.getRateLimitKbps() != null) data.put("rateLimitKbps", rule.getRateLimitKbps());
        JobDetail job = JobBuilder.newJob(jobClass)
                .withIdentity(jobKey)
                .usingJobData(data)
                .storeDurably()
                .build();
        Trigger trigger = TriggerBuilder.newTrigger()
                .withIdentity(triggerKey)
                .forJob(job)
                .withSchedule(CronScheduleBuilder.cronSchedule(cron))
                .build();
        scheduler.scheduleJob(job, trigger);
    }

    public static class StartAllJob implements Job {
        @Autowired ApplicationContext context;
        @Override
        public void execute(JobExecutionContext jobContext) {
            DownloadService downloads = context.getBean(DownloadService.class);
            RateLimiter limiter = context.getBean(RateLimiter.class);
            JobDataMap data = jobContext.getMergedJobDataMap();
            if (data.containsKey("rateLimitKbps")) {
                long kbps = data.getLong("rateLimitKbps");
                limiter.setLimit(kbps * 1024L);
            }
            downloads.resumeAll();
            log.info("scheduled: resumed queue");
        }
    }

    public static class PauseAllJob implements Job {
        @Autowired ApplicationContext context;
        @Override
        public void execute(JobExecutionContext jobContext) {
            DownloadService downloads = context.getBean(DownloadService.class);
            downloads.pauseAll();
            log.info("scheduled: paused queue");
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
