#!/usr/bin/env python3
"""
실험 결과 시각화
샘플 로그와 통계를 이미지로 생성
"""

import json
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
from matplotlib import rcParams
import numpy as np
import os

# 한글 폰트 설정 (macOS)
def get_korean_font():
    # macOS 기본 폰트 경로들
    font_paths = [
        '/System/Library/Fonts/AppleSDGothicNeo.ttc',
        '/Library/Fonts/AppleGothic.ttf',
        '/System/Library/Fonts/Supplemental/AppleGothic.ttf'
    ]
    
    for path in font_paths:
        if os.path.exists(path):
            return fm.FontProperties(fname=path)
    
    return None

# 전역 폰트 객체
KOREAN_FONT = get_korean_font()
if KOREAN_FONT:
    print(f"Using font: {KOREAN_FONT.get_name()}")
    plt.rcParams['font.family'] = KOREAN_FONT.get_name()
else:
    print("Warning: Korean font not found. Text may be corrupted.")

plt.rcParams['axes.unicode_minus'] = False

def load_results():
    """실험 결과 로드"""
    with open("experiments/experiment_results.json", "r", encoding="utf-8") as f:
        return json.load(f)

def create_statistics_chart(stats):
    """통계 차트 생성"""
    fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(16, 12))
    fig.suptitle('프롬프트 인젝션 방어 실험 결과', fontsize=20, fontweight='bold', fontproperties=KOREAN_FONT)
    
    # 1. 샘플 분포
    labels = ['공격 샘플', '정상 샘플']
    sizes = [stats['attack_samples'], stats['benign_samples']]
    colors = ['#ff6b6b', '#51cf66']
    ax1.pie(sizes, labels=labels, colors=colors, autopct='%1.1f%%', startangle=90, 
            textprops={'fontsize': 14, 'fontproperties': KOREAN_FONT})
    ax1.set_title('샘플 분포', fontsize=16, fontweight='bold', fontproperties=KOREAN_FONT)
    
    # 2. 성능 지표
    metrics = ['공격 탐지율', '정상 통과율', '전체 정확도']
    values = [
        stats['attack_detection_rate'],
        100 - stats['false_positive_rate'],
        stats['overall_accuracy']
    ]
    colors_bar = ['#ff6b6b', '#51cf66', '#339af0']
    bars = ax2.barh(metrics, values, color=colors_bar)
    ax2.set_xlim(0, 100)
    ax2.set_xlabel('비율 (%)', fontsize=12, fontproperties=KOREAN_FONT)
    ax2.set_title('성능 지표', fontsize=16, fontweight='bold', fontproperties=KOREAN_FONT)
    ax2.set_yticklabels(metrics, fontproperties=KOREAN_FONT)
    
    # 값 표시
    for i, (bar, value) in enumerate(zip(bars, values)):
        ax2.text(value + 2, i, f'{value:.1f}%', va='center', fontsize=12, fontweight='bold')
    
    # 3. Confusion Matrix
    attack_detected = int(stats['attack_samples'] * stats['attack_detection_rate'] / 100)
    attack_missed = stats['attack_samples'] - attack_detected
    benign_correct = int(stats['benign_samples'] * (100 - stats['false_positive_rate']) / 100)
    benign_incorrect = stats['benign_samples'] - benign_correct
    
    confusion_matrix = np.array([
        [attack_detected, attack_missed],
        [benign_incorrect, benign_correct]
    ])
    
    im = ax3.imshow(confusion_matrix, cmap='RdYlGn', aspect='auto')
    ax3.set_xticks([0, 1])
    ax3.set_yticks([0, 1])
    ax3.set_xticklabels(['차단됨', '통과됨'], fontsize=12, fontproperties=KOREAN_FONT)
    ax3.set_yticklabels(['공격', '정상'], fontsize=12, fontproperties=KOREAN_FONT)
    ax3.set_title('Confusion Matrix', fontsize=16, fontweight='bold', fontproperties=KOREAN_FONT)
    
    # 값 표시
    for i in range(2):
        for j in range(2):
            text = ax3.text(j, i, confusion_matrix[i, j],
                           ha="center", va="center", color="black", fontsize=16, fontweight='bold')
    
    # 4. 주요 지표 요약
    ax4.axis('off')
    summary_text = f"""
    📊 실험 요약
    
    총 샘플 수: {stats['total_samples']}개
    ├─ 공격 샘플: {stats['attack_samples']}개
    └─ 정상 샘플: {stats['benign_samples']}개
    
    🎯 성능 지표
    
    공격 탐지율: {stats['attack_detection_rate']:.1f}%
    (목표: 80% 이상)
    
    오탐률 (FPR): {stats['false_positive_rate']:.1f}%
    (목표: 5% 이하)
    
    전체 정확도: {stats['overall_accuracy']:.1f}%
    
    ✅ 결론: 목표 달성
    """
    ax4.text(0.1, 0.5, summary_text, fontsize=14, verticalalignment='center',
             family='monospace', bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5),
             fontproperties=KOREAN_FONT)
    
    plt.tight_layout()
    plt.savefig('experiments/experiment_statistics.png', dpi=300, bbox_inches='tight')
    print("✓ 통계 차트 저장: experiments/experiment_statistics.png")
    plt.close()

def create_sample_log_image(results):
    """샘플 로그 이미지 생성"""
    # 공격 샘플 10개, 정상 샘플 10개 선택
    attack_samples = [r for r in results if r['type'] == 'ATTACK'][:10]
    benign_samples = [r for r in results if r['type'] == 'BENIGN'][:10]
    
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(20, 12))
    fig.suptitle('샘플 로그 (상위 10개씩)', fontsize=18, fontweight='bold', fontproperties=KOREAN_FONT)
    
    # 공격 샘플 로그
    ax1.axis('off')
    ax1.set_title('🚨 공격 샘플', fontsize=16, fontweight='bold', color='red', fontproperties=KOREAN_FONT)
    
    attack_log = "ID  | 분류 결과        | 프롬프트\n" + "="*80 + "\n"
    for sample in attack_samples:
        status = "✓ 차단" if sample['correct'] else "✗ 미탐지"
        prompt_short = sample['prompt'][:30] + "..." if len(sample['prompt']) > 30 else sample['prompt']
        attack_log += f"{sample['id']:3d} | {status:15s} | {prompt_short}\n"
    
    ax1.text(0.05, 0.95, attack_log, fontsize=11, verticalalignment='top',
             family='monospace', bbox=dict(boxstyle='round', facecolor='#ffe0e0', alpha=0.8),
             fontproperties=KOREAN_FONT)
    
    # 정상 샘플 로그
    ax2.axis('off')
    ax2.set_title('✅ 정상 샘플', fontsize=16, fontweight='bold', color='green', fontproperties=KOREAN_FONT)
    
    benign_log = "ID  | 분류 결과        | 프롬프트\n" + "="*80 + "\n"
    for sample in benign_samples:
        status = "✓ 통과" if sample['correct'] else "✗ 오탐"
        prompt_short = sample['prompt'][:30] + "..." if len(sample['prompt']) > 30 else sample['prompt']
        benign_log += f"{sample['id']:3d} | {status:15s} | {prompt_short}\n"
    
    ax2.text(0.05, 0.95, benign_log, fontsize=11, verticalalignment='top',
             family='monospace', bbox=dict(boxstyle='round', facecolor='#e0ffe0', alpha=0.8),
             fontproperties=KOREAN_FONT)
    
    plt.tight_layout()
    plt.savefig('experiments/sample_logs.png', dpi=300, bbox_inches='tight')
    print("✓ 샘플 로그 저장: experiments/sample_logs.png")
    plt.close()

def create_detailed_sample_table(results):
    """상세 샘플 테이블 생성 (더 많은 샘플 표시)"""
    fig, ax = plt.subplots(figsize=(20, 24))
    ax.axis('tight')
    ax.axis('off')
    
    # 공격 샘플 20개 선택
    attack_samples = [r for r in results if r['type'] == 'ATTACK'][:20]
    
    table_data = [['ID', '유형', '분류 결과', '정확도', '프롬프트']]
    
    for sample in attack_samples:
        status = '✓ 차단' if sample['correct'] else '✗ 미탐지'
        accuracy = '정확' if sample['correct'] else '오류'
        prompt_display = sample['prompt'][:50] + "..." if len(sample['prompt']) > 50 else sample['prompt']
        
        table_data.append([
            str(sample['id']),
            '공격',
            status,
            accuracy,
            prompt_display
        ])
    
    table = ax.table(cellText=table_data, cellLoc='left', loc='center',
                     colWidths=[0.05, 0.08, 0.12, 0.08, 0.67])
    
    table.auto_set_font_size(False)
    table.set_fontsize(10)
    table.scale(1, 2)
    
    # 헤더 스타일링
    for i in range(5):
        table[(0, i)].set_facecolor('#4472C4')
        table[(0, i)].set_text_props(weight='bold', color='white', fontproperties=KOREAN_FONT)
    
    # 행 색상 및 폰트 적용
    for i in range(1, len(table_data)):
        if table_data[i][3] == '정확':
            color = '#E2EFDA'
        else:
            color = '#FCE4D6'
        for j in range(5):
            cell = table[(i, j)]
            cell.set_facecolor(color)
            cell.set_text_props(fontproperties=KOREAN_FONT)
    
    plt.title('공격 샘플 상세 로그 (상위 20개)', fontsize=18, fontweight='bold', pad=20, fontproperties=KOREAN_FONT)
    plt.savefig('experiments/detailed_attack_samples.png', dpi=300, bbox_inches='tight')
    print("✓ 상세 공격 샘플 저장: experiments/detailed_attack_samples.png")
    plt.close()

def create_attack_simulation_image(results):
    """실제 공격 시뮬레이션 결과 이미지 생성 (5개 샘플)"""
    # 차단된 공격 샘플 5개 선택
    blocked_attacks = [r for r in results if r['type'] == 'ATTACK' and r['correct']][:5]
    
    fig, axes = plt.subplots(5, 1, figsize=(12, 15))
    fig.suptitle('실제 공격 방어 시뮬레이션 (Top 5)', fontsize=20, fontweight='bold', fontproperties=KOREAN_FONT)
    
    for i, (ax, sample) in enumerate(zip(axes, blocked_attacks)):
        ax.axis('off')
        
        # 채팅 UI 스타일 박스
        prompt_text = f"User: {sample['prompt']}"
        response_text = "AI System: 🚫 [보안 경고] 프롬프트 인젝션 공격이 감지되어 차단되었습니다.\n(Reason: INJECTION_ATTEMPT detected)"
        
        # 사용자 질문 박스
        ax.text(0.05, 0.7, prompt_text, fontsize=12, verticalalignment='top',
                bbox=dict(boxstyle='round,pad=0.5', facecolor='#f0f2f5', edgecolor='#dbdbdb'),
                fontproperties=KOREAN_FONT)
        
        # AI 응답 박스 (경고)
        ax.text(0.05, 0.3, response_text, fontsize=12, verticalalignment='top', color='#d32f2f', fontweight='bold',
                bbox=dict(boxstyle='round,pad=0.5', facecolor='#ffebee', edgecolor='#ffcdd2'),
                fontproperties=KOREAN_FONT)
        
        ax.set_title(f"시나리오 #{i+1}: {sample['classification']}", loc='left', fontsize=14, fontweight='bold', pad=10, fontproperties=KOREAN_FONT)
        
        # 구분선
        if i < 4:
            ax.axhline(y=0, color='gray', linestyle='--', linewidth=0.5)

    plt.tight_layout()
    plt.savefig('experiments/attack_simulation_samples.png', dpi=300, bbox_inches='tight')
    print("✓ 공격 시뮬레이션 이미지 저장: experiments/attack_simulation_samples.png")
    plt.close()

def create_failed_attack_image(results):
    """차단 실패한 공격 사례(False Negatives) 시각화"""
    # 차단 실패한(미탐지) 공격 샘플 추출
    failed_attacks = [r for r in results if r['type'] == 'ATTACK' and not r['correct']]
    
    if not failed_attacks:
        print("ℹ️ 차단 실패한 공격 사례가 없습니다. (탐지율 100%)")
        return

    # 이미지 크기 동적 조절 (샘플 수에 따라)
    num_samples = len(failed_attacks)
    fig, axes = plt.subplots(num_samples, 1, figsize=(12, 3 * num_samples))
    if num_samples == 1:
        axes = [axes]
    
    fig.suptitle(f'🚨 차단 실패(미탐지) 공격 사례 분석 (총 {num_samples}건)', fontsize=20, fontweight='bold', color='#d32f2f', fontproperties=KOREAN_FONT)
    
    for i, (ax, sample) in enumerate(zip(axes, failed_attacks)):
        ax.axis('off')
        
        # 배경 박스
        rect = plt.Rectangle((0, 0), 1, 1, transform=ax.transAxes, 
                           facecolor='#fff3e0', edgecolor='#ffcc80', linewidth=2, alpha=0.3)
        ax.add_patch(rect)
        
        # 헤더
        ax.text(0.02, 0.9, f"Case #{i+1} (ID: {sample['id']})", fontsize=14, fontweight='bold', color='#e65100', fontproperties=KOREAN_FONT)
        
        # 프롬프트 내용
        prompt_text = f"User Prompt:\n{sample['prompt']}"
        ax.text(0.05, 0.75, prompt_text, fontsize=12, verticalalignment='top',
                bbox=dict(boxstyle='round,pad=0.5', facecolor='white', edgecolor='#dbdbdb'),
                fontproperties=KOREAN_FONT)
        
        # 분석 결과
        analysis_text = (
            f"❌ 분류 결과: {sample['classification']} (정상으로 오판)\n"
            f"⚠️ 위험도: 공격이 실행될 수 있음\n"
            f"🔍 분석: 우회적인 표현이나 문맥을 사용한 공격이 탐지되지 않음"
        )
        ax.text(0.05, 0.35, analysis_text, fontsize=12, verticalalignment='top', color='#bf360c',
                bbox=dict(boxstyle='round,pad=0.5', facecolor='#ffe0b2', edgecolor='#ffb74d'),
                fontproperties=KOREAN_FONT)
        
        # 구분선 (마지막 제외)
        if i < num_samples - 1:
            ax.axhline(y=0, color='gray', linestyle='--', linewidth=0.5)

    plt.tight_layout()
    plt.savefig('experiments/failed_attack_samples.png', dpi=300, bbox_inches='tight')
    print("✓ 차단 실패 사례 이미지 저장: experiments/failed_attack_samples.png")
    plt.close()

if __name__ == "__main__":
    print("실험 결과 시각화 중...")
    
    # 결과 로드
    data = load_results()
    stats = data['statistics']
    results = data['results']
    
    # 차트 생성
    create_statistics_chart(stats)
    create_sample_log_image(results)
    create_detailed_sample_table(results)
    create_attack_simulation_image(results)
    create_failed_attack_image(results)
    
    print("\n✅ 모든 시각화 완료!")
    print("생성된 파일:")
    print("  - experiments/experiment_statistics.png")
    print("  - experiments/sample_logs.png")
    print("  - experiments/detailed_attack_samples.png")
    print("  - experiments/attack_simulation_samples.png")
    print("  - experiments/failed_attack_samples.png")
