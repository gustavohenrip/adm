package com.opendownloader.odm.persistence;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

public interface SegmentRepository extends JpaRepository<SegmentEntity, Long> {
    List<SegmentEntity> findByDownloadIdOrderBySegmentIndexAsc(String downloadId);

    @Transactional
    void deleteByDownloadId(String downloadId);
}
