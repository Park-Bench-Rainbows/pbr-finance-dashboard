import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SummaryService } from '../summary-service';
import { Income } from '../../domain/income';
import { RecurringExpense } from '../../domain/recurring-expense';
import { IncomeRepository } from '../../repositories/income-repository';
import { ExpenseRepository } from '../../repositories/expense-repository';
import { SavingsPlanService } from '../savings-plan-service';
import { DailyExpenseService } from '../daily-expense-service';
import { BudgetService } from '../budget-service';

describe('SummaryService', () => {
  let service: SummaryService;
  let mockIncomeRepo: IncomeRepository;
  let mockExpenseRepo: ExpenseRepository;
  let mockSavingsService: SavingsPlanService;
  let mockDailyExpenseService: DailyExpenseService;
  let mockBudgetService: BudgetService;
  const userId = 'test-user-123';
  const month = '2026-01';

  beforeEach(() => {
    // Create mock repositories
    mockIncomeRepo = {
      findActiveForMonth: vi.fn().mockResolvedValue([]),
    } as any;

    mockExpenseRepo = {
      findActiveForMonth: vi.fn().mockResolvedValue([]),
    } as any;

    mockSavingsService = {
      calculateMonthlyTotal: vi.fn().mockResolvedValue(0),
    } as any;

    mockDailyExpenseService = {
      calculateMonthlyTotal: vi.fn().mockResolvedValue(0),
      groupByCategory: vi.fn().mockResolvedValue({}),
      groupByDay: vi.fn().mockResolvedValue([]),
    } as any;

    mockBudgetService = {
      getBudgetsForMonth: vi.fn().mockResolvedValue([]),
      computeRemainingByCategory: vi.fn().mockResolvedValue({}),
    } as any;

    service = new SummaryService(
      mockIncomeRepo,
      mockExpenseRepo,
      mockSavingsService,
      mockDailyExpenseService,
      mockBudgetService
    );
  });

  describe('getMonthlySummary', () => {
    it('should return zero totals when no income or expenses exist', async () => {
      const summary = await service.getMonthlySummary(userId, month);

      expect(summary.month).toBe(month);
      expect(summary.totalIncome).toBe(0);
      expect(summary.totalExpenses).toBe(0);
      expect(summary.totalSavings).toBe(0);
      expect(summary.totalDailySpend).toBe(0);
      expect(summary.remainingDisposable).toBe(0);
      expect(summary.disposableIncome).toBe(0);
      expect(summary.expensesByCategory).toEqual({});
      expect(summary.dailySpendByCategory).toEqual({});
      expect(summary.dailySpendByDay).toEqual([]);
      expect(summary.budgetsByCategory).toEqual({});
      expect(summary.budgetRemainingByCategory).toEqual({});
    });

    it('should calculate monthly income correctly', async () => {
      const mockIncomes: Income[] = [
        {
          id: '1',
          userId,
          name: 'Salary',
          amount: 5000,
          frequency: 'monthly',
          startDate: new Date('2025-01-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(mockIncomeRepo.findActiveForMonth).mockResolvedValue(mockIncomes);

      const summary = await service.getMonthlySummary(userId, month);

      expect(summary.totalIncome).toBe(5000);
      expect(summary.disposableIncome).toBe(5000);
    });

    it('should convert biweekly income to monthly equivalent', async () => {
      const mockIncomes: Income[] = [
        {
          id: '1',
          userId,
          name: 'Biweekly Salary',
          amount: 2000, // $2000 per paycheck
          frequency: 'biweekly',
          startDate: new Date('2025-01-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(mockIncomeRepo.findActiveForMonth).mockResolvedValue(mockIncomes);

      const summary = await service.getMonthlySummary(userId, month);

      // 2000 * 26 / 12 = 4333.33...
      expect(summary.totalIncome).toBeCloseTo(4333.33, 2);
    });

    it('should handle mixed monthly and biweekly income', async () => {
      const mockIncomes: Income[] = [
        {
          id: '1',
          userId,
          name: 'Monthly Salary',
          amount: 3000,
          frequency: 'monthly',
          startDate: new Date('2025-01-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          userId,
          name: 'Biweekly Bonus',
          amount: 600, // $600 per paycheck
          frequency: 'biweekly',
          startDate: new Date('2025-01-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(mockIncomeRepo.findActiveForMonth).mockResolvedValue(mockIncomes);

      const summary = await service.getMonthlySummary(userId, month);

      // 3000 + (600 * 26 / 12) = 3000 + 1300 = 4300
      expect(summary.totalIncome).toBe(4300);
    });

    it('should calculate monthly expenses correctly', async () => {
      const mockExpenses: RecurringExpense[] = [
        {
          id: '1',
          userId,
          name: 'Rent',
          amount: 1500,
          frequency: 'monthly',
          category: 'housing',
          startDate: new Date('2025-01-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(mockExpenseRepo.findActiveForMonth).mockResolvedValue(mockExpenses);

      const summary = await service.getMonthlySummary(userId, month);

      expect(summary.totalExpenses).toBe(1500);
      expect(summary.disposableIncome).toBe(-1500);
    });

    it('should convert annual expenses to monthly equivalent', async () => {
      const mockExpenses: RecurringExpense[] = [
        {
          id: '1',
          userId,
          name: 'Car Insurance',
          amount: 1200, // $1200 per year
          frequency: 'annual',
          category: 'insurance',
          startDate: new Date('2025-01-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(mockExpenseRepo.findActiveForMonth).mockResolvedValue(mockExpenses);

      const summary = await service.getMonthlySummary(userId, month);

      // 1200 / 12 = 100
      expect(summary.totalExpenses).toBe(100);
    });

    it('should handle mixed monthly and annual expenses', async () => {
      const mockExpenses: RecurringExpense[] = [
        {
          id: '1',
          userId,
          name: 'Rent',
          amount: 1500,
          frequency: 'monthly',
          category: 'housing',
          startDate: new Date('2025-01-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          userId,
          name: 'Insurance',
          amount: 1200,
          frequency: 'annual',
          category: 'insurance',
          startDate: new Date('2025-01-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(mockExpenseRepo.findActiveForMonth).mockResolvedValue(mockExpenses);

      const summary = await service.getMonthlySummary(userId, month);

      // 1500 + (1200 / 12) = 1500 + 100 = 1600
      expect(summary.totalExpenses).toBe(1600);
    });

    it('should group expenses by category correctly', async () => {
      const mockExpenses: RecurringExpense[] = [
        {
          id: '1',
          userId,
          name: 'Rent',
          amount: 1500,
          frequency: 'monthly',
          category: 'housing',
          startDate: new Date('2025-01-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          userId,
          name: 'Netflix',
          amount: 15,
          frequency: 'monthly',
          category: 'subscriptions',
          startDate: new Date('2025-01-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '3',
          userId,
          name: 'Spotify',
          amount: 10,
          frequency: 'monthly',
          category: 'subscriptions',
          startDate: new Date('2025-01-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(mockExpenseRepo.findActiveForMonth).mockResolvedValue(mockExpenses);

      const summary = await service.getMonthlySummary(userId, month);

      expect(summary.expensesByCategory).toEqual({
        housing: 1500,
        subscriptions: 25, // 15 + 10
      });
    });

    it('should create sparse category map (only categories with expenses)', async () => {
      const mockExpenses: RecurringExpense[] = [
        {
          id: '1',
          userId,
          name: 'Rent',
          amount: 1500,
          frequency: 'monthly',
          category: 'housing',
          startDate: new Date('2025-01-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(mockExpenseRepo.findActiveForMonth).mockResolvedValue(mockExpenses);

      const summary = await service.getMonthlySummary(userId, month);

      // Should only have 'housing', not all categories
      expect(Object.keys(summary.expensesByCategory)).toEqual(['housing']);
      expect(summary.expensesByCategory.utilities).toBeUndefined();
      expect(summary.expensesByCategory.insurance).toBeUndefined();
    });

    it('should group annual expenses by category with monthly conversion', async () => {
      const mockExpenses: RecurringExpense[] = [
        {
          id: '1',
          userId,
          name: 'Car Insurance',
          amount: 1200,
          frequency: 'annual',
          category: 'insurance',
          startDate: new Date('2025-01-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          userId,
          name: 'Home Insurance',
          amount: 600,
          frequency: 'annual',
          category: 'insurance',
          startDate: new Date('2025-01-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(mockExpenseRepo.findActiveForMonth).mockResolvedValue(mockExpenses);

      const summary = await service.getMonthlySummary(userId, month);

      // (1200 / 12) + (600 / 12) = 100 + 50 = 150
      expect(summary.expensesByCategory.insurance).toBe(150);
    });

    it('should calculate disposable income correctly', async () => {
      const mockIncomes: Income[] = [
        {
          id: '1',
          userId,
          name: 'Salary',
          amount: 5000,
          frequency: 'monthly',
          startDate: new Date('2025-01-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockExpenses: RecurringExpense[] = [
        {
          id: '1',
          userId,
          name: 'Rent',
          amount: 1500,
          frequency: 'monthly',
          category: 'housing',
          startDate: new Date('2025-01-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          userId,
          name: 'Utilities',
          amount: 200,
          frequency: 'monthly',
          category: 'utilities',
          startDate: new Date('2025-01-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(mockIncomeRepo.findActiveForMonth).mockResolvedValue(mockIncomes);
      vi.mocked(mockExpenseRepo.findActiveForMonth).mockResolvedValue(mockExpenses);
      vi.mocked((mockSavingsService as any).calculateMonthlyTotal).mockResolvedValue(0);
      vi.mocked((mockDailyExpenseService as any).calculateMonthlyTotal).mockResolvedValue(0);

      const summary = await service.getMonthlySummary(userId, month);

      expect(summary.totalIncome).toBe(5000);
      expect(summary.totalExpenses).toBe(1700);
      expect(summary.disposableIncome).toBe(3300);
      expect(summary.remainingDisposable).toBe(3300);
    });

    it('should handle negative disposable income (expenses exceed income)', async () => {
      const mockIncomes: Income[] = [
        {
          id: '1',
          userId,
          name: 'Salary',
          amount: 2000,
          frequency: 'monthly',
          startDate: new Date('2025-01-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockExpenses: RecurringExpense[] = [
        {
          id: '1',
          userId,
          name: 'Rent',
          amount: 2500,
          frequency: 'monthly',
          category: 'housing',
          startDate: new Date('2025-01-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(mockIncomeRepo.findActiveForMonth).mockResolvedValue(mockIncomes);
      vi.mocked(mockExpenseRepo.findActiveForMonth).mockResolvedValue(mockExpenses);

      const summary = await service.getMonthlySummary(userId, month);

      expect(summary.disposableIncome).toBe(-500);
    });

    it('should handle complex real-world scenario', async () => {
      const mockIncomes: Income[] = [
        {
          id: '1',
          userId,
          name: 'Main Job',
          amount: 3500,
          frequency: 'monthly',
          startDate: new Date('2025-01-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          userId,
          name: 'Side Gig',
          amount: 800,
          frequency: 'biweekly',
          startDate: new Date('2025-06-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockExpenses: RecurringExpense[] = [
        {
          id: '1',
          userId,
          name: 'Rent',
          amount: 1200,
          frequency: 'monthly',
          category: 'housing',
          startDate: new Date('2025-01-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          userId,
          name: 'Electricity',
          amount: 100,
          frequency: 'monthly',
          category: 'utilities',
          startDate: new Date('2025-01-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '3',
          userId,
          name: 'Netflix',
          amount: 15,
          frequency: 'monthly',
          category: 'subscriptions',
          startDate: new Date('2025-01-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '4',
          userId,
          name: 'Car Insurance',
          amount: 1200,
          frequency: 'annual',
          category: 'insurance',
          startDate: new Date('2025-01-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '5',
          userId,
          name: 'Gas',
          amount: 150,
          frequency: 'monthly',
          category: 'transportation',
          startDate: new Date('2025-01-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(mockIncomeRepo.findActiveForMonth).mockResolvedValue(mockIncomes);
      vi.mocked(mockExpenseRepo.findActiveForMonth).mockResolvedValue(mockExpenses);
      vi.mocked((mockSavingsService as any).calculateMonthlyTotal).mockResolvedValue(0);
      vi.mocked((mockDailyExpenseService as any).calculateMonthlyTotal).mockResolvedValue(0);

      const summary = await service.getMonthlySummary(userId, month);

      // Income: 3500 + (800 * 26 / 12) = 3500 + 1733.33 = 5233.33
      expect(summary.totalIncome).toBeCloseTo(5233.33, 2);

      // Expenses: 1200 + 100 + 15 + (1200/12) + 150 = 1565
      expect(summary.totalExpenses).toBe(1565);

      // Disposable: 5233.33 - 1565 = 3668.33
      expect(summary.disposableIncome).toBeCloseTo(3668.33, 2);
      expect(summary.remainingDisposable).toBeCloseTo(3668.33, 2);

      expect(summary.expensesByCategory).toEqual({
        housing: 1200,
        utilities: 100,
        subscriptions: 15,
        insurance: 100, // 1200 / 12
        transportation: 150,
      });
    });
  });
});
