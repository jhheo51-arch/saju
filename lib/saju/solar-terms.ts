import lunar from "lunar-javascript";

const { Solar } = lunar;

const termNames: Record<string, string> = {
  小寒: "소한", 大寒: "대한", 立春: "입춘", 雨水: "우수", 惊蛰: "경칩", 春分: "춘분", 清明: "청명", 谷雨: "곡우",
  立夏: "입하", 小满: "소만", 芒种: "망종", 夏至: "하지", 小暑: "소서", 大暑: "대서", 立秋: "입추", 处暑: "처서",
  白露: "백로", 秋分: "추분", 寒露: "한로", 霜降: "상강", 立冬: "입동", 小雪: "소설", 大雪: "대설", 冬至: "동지",
  DA_XUE: "대설", DONG_ZHI: "동지", XIAO_HAN: "소한", DA_HAN: "대한", LI_CHUN: "입춘", YU_SHUI: "우수", JING_ZHE: "경칩",
};

export type CalendarDay = { date: string; day: number; weekday: string; term?: string };

function addDays(date: string, count: number): string {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + count);
  return day.toISOString().slice(0, 10);
}

function koreaDateForChineseSolarTime(solarTime: string): string {
  const [date, time] = solarTime.split(" ");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute, second] = time.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour + 1, minute, second)).toISOString().slice(0, 10);
}

export function weekCalendar(startDate: string): { days: CalendarDay[]; nextTerm?: { date: string; name: string } } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || Number.isNaN(Date.parse(`${startDate}T00:00:00Z`))) return { days: [] };
  const weekdays = ["월", "화", "수", "목", "금", "토", "일"];
  const days: CalendarDay[] = weekdays.map((weekday, index) => ({ date: addDays(startDate, index), day: Number(addDays(startDate, index).slice(-2)), weekday }));
  try {
    const [year, month, day] = startDate.split("-").map(Number);
    const lunarDay = Solar.fromYmdHms(year, month, day, 12, 0, 0).getLunar() as unknown as { getJieQiTable(): Record<string, { toYmdHms(): string }> };
    const terms = Object.entries(lunarDay.getJieQiTable()).filter(([key]) => key in termNames)
      .map(([key, value]) => ({ date: koreaDateForChineseSolarTime(value.toYmdHms()), name: termNames[key] }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const weekEnd = days[6].date;
    for (const calendarDay of days) calendarDay.term = terms.find((term) => term.date === calendarDay.date)?.name;
    return { days, nextTerm: terms.find((term) => term.date > weekEnd) };
  } catch {
    return { days };
  }
}
