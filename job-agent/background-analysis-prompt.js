// 同背景求职者去向分析提示词
// 专门用于分析与该用户背景相似的求职者的就业去向情况

module.exports = `以下是用户的背景信息：

{userInfo}

{searchResults}

请分析与该用户背景相似的求职者的就业去向情况，按以下格式输出纯HTML（不要用代码块包裹）：

<div class="background-report">
  <div class="report-header">
    <div class="report-title">同背景求职者去向分析</div>
    <div class="report-date">分析日期：{today}</div>
  </div>
  
  <div class="report-summary">一到两句话总体概括同背景求职者的去向情况</div>
  
  <div class="report-section">
    <div class="section-title">📍 城市分布</div>
    <div class="city-grid">
      <div class="city-card">
        <div class="city-name">城市名</div>
        <div class="city-count">人数/比例</div>
        <div class="city-salary">平均薪资：XXK</div>
        <div class="city-source">来源：<a href="链接" target="_blank">查看详情</a></div>
      </div>
      <!-- 更多城市 -->
    </div>
  </div>
  
  <div class="report-section">
    <div class="section-title">💰 薪资水平</div>
    <div class="salary-ranges">
      <div class="salary-range">
        <div class="range-label">10-15K</div>
        <div class="range-count">占比 XX%</div>
        <div class="range-source">来源：<a href="链接" target="_blank">统计报告</a></div>
      </div>
      <!-- 更多薪资段 -->
    </div>
  </div>
  
  <div class="report-section">
    <div class="section-title">💼 岗位情况</div>
    <table class="job-table">
      <thead>
        <tr>
          <th>岗位名称</th>
          <th>公司</th>
          <th>城市</th>
          <th>薪资</th>
          <th>来源</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>前端开发工程师</td>
          <td>腾讯</td>
          <td>深圳</td>
          <td>15-25K</td>
          <td><a href="链接" target="_blank">BOSS直聘</a></td>
        </tr>
        <!-- 更多岗位 -->
      </tbody>
    </table>
  </div>
  
  <div class="report-insight">
    <div class="insight-title">🔍 关键洞察</div>
    <div class="insight-content">最重要的1-2个发现，比如：同背景求职者主要集中在一线城市，薪资集中在10-20K范围</div>
  </div>
</div>

【分析要求】
1. 数据尽量基于搜索结果，如果搜索结果不足则基于你的知识并标注"预估值"
2. 每个数据点都要标注信息来源（链接或参考资料），使用 <a href="链接" target="_blank">来源名称</a> 格式
3. 城市分布要显示主要城市的人数/比例和平均薪资，至少列出3-5个城市
4. 薪资水平要显示不同薪资段的人数/比例，至少列出3-4个薪资段
5. 岗位情况要列出具体的岗位名称、公司、城市、薪资，至少列出5-8个真实岗位
6. 分析要客观中立，给出具体数字和百分比
7. 直接输出纯HTML，不要用代码块包裹。

今天是{today}。`;
