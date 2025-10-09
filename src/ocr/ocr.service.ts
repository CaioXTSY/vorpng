import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { createWorker, Worker, PSM, OEM } from 'tesseract.js';
import { OcrOptionsDto, OcrResultDto } from './dto/ocr.dto';

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private worker: Worker;

  async onModuleInit() {
    this.logger.log('Inicializando worker do Tesseract...');
    this.worker = await createWorker('por+eng', OEM.TESSERACT_LSTM_COMBINED, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          this.logger.debug(`OCR Progress: ${(m.progress * 100).toFixed(1)}%`);
        }
      },
    });
    this.logger.log('Worker do Tesseract inicializado com sucesso');
  }

  async onModuleDestroy() {
    if (this.worker) {
      this.logger.log('Finalizando worker do Tesseract...');
      await this.worker.terminate();
    }
  }

  async processImageBuffer(
    imageBuffer: Buffer,
    options: OcrOptionsDto = {},
  ): Promise<OcrResultDto> {
    const startTime = Date.now();

    try {
      if (!imageBuffer || imageBuffer.length === 0) {
        throw new BadRequestException('Buffer de imagem está vazio');
      }

      if (options.language && options.language !== 'por+eng') {
        await this.worker.reinitialize(options.language);
      }

      await this.worker.setParameters({
        tessedit_pageseg_mode: (options.psm || 6) as unknown as PSM,
        tessedit_ocr_engine_mode: (options.oem || 3) as unknown as OEM,
        tessedit_char_whitelist: '', 
        preserve_interword_spaces: '1',
        user_defined_dpi: '300',
        textord_really_old_xheight: '1',
        textord_min_xheight: '10',
        textord_tabfind_show_vlines: '0',
        textord_use_cjk_fp_model: '0',
        load_system_dawg: '1',
        load_freq_dawg: '1',
        load_unambig_dawg: '1',
        load_punc_dawg: '1',
        load_number_dawg: '1',
      });

      this.logger.debug('Iniciando reconhecimento de texto...');

      const {
        data: { text, confidence },
      } = await this.worker.recognize(imageBuffer);

      const processingTime = Date.now() - startTime;

      this.logger.log(
        `OCR concluído em ${processingTime}ms com confiança ${confidence.toFixed(1)}%`,
      );

      const originalText = text;

      const cleanText = this.postProcessText(text);

      if (confidence < 70) {
        this.logger.warn(
          `OCR com baixa confiança (${confidence.toFixed(1)}%). Resultado pode não ser confiável.`,
        );
      }

      return {
        text: cleanText,
        originalText,
        confidence: Math.round(confidence * 100) / 100,
      };
    } catch (error) {
      this.logger.error('Erro durante o processamento OCR:', error);
      throw new BadRequestException(
        `Falha no processamento OCR: ${error.message}`,
      );
    }
  }

  async processImageFromPath(
    imagePath: string,
    options: OcrOptionsDto = {},
  ): Promise<OcrResultDto> {
    const fs = require('fs').promises;
    
    try {
      const imageBuffer = await fs.readFile(imagePath);
      return this.processImageBuffer(imageBuffer, options);
    } catch (error) {
      this.logger.error('Erro ao ler arquivo de imagem:', error);
      throw new BadRequestException(
        `Falha ao ler arquivo de imagem: ${error.message}`,
      );
    }
  }

  validateImageType(mimetype: string): boolean {
    const supportedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/bmp',
      'image/tiff',
      'image/webp',
    ];
    return supportedTypes.includes(mimetype.toLowerCase());
  }


  private postProcessText(text: string): string {
    if (!text || text.trim().length === 0) {
      return text;
    }

    let processedText = text;

    processedText = processedText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();

    if (this.detectTableStructure(processedText)) {
      processedText = this.formatAsTable(processedText);
    } else {
      processedText = this.formatAsText(processedText);
    }

    processedText = this.fixCommonOcrErrors(processedText);

    return processedText.trim();
  }

  private detectTableStructure(text: string): boolean {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    if (lines.length < 2) return false;

    let potentialColumns = 0;
    let consistentRows = 0;

    for (const line of lines) {
      const spaces = line.match(/\s{2,}/g) || [];
      const tabs = line.match(/\t/g) || [];
      const separators = spaces.length + tabs.length;

      if (separators > 0) {
        potentialColumns = Math.max(potentialColumns, separators + 1);
        consistentRows++;
      }
    }

    return consistentRows / lines.length > 0.7 && potentialColumns >= 2;
  }

  private formatAsTable(text: string): string {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const formattedLines: string[] = [];

    for (const line of lines) {
      let formatted = line
        .replace(/\s{2,}/g, ' | ')
        .replace(/\t/g, ' | ')
        .trim();

      if (!formatted.startsWith('|')) {
        formatted = '| ' + formatted;
      }
      if (!formatted.endsWith('|')) {
        formatted = formatted + ' |';
      }

      formattedLines.push(formatted);
    }

    if (formattedLines.length > 1) {
      const headerSeparator = formattedLines[0]
        .replace(/[^|]/g, '-')
        .replace(/\|/g, '|');
      formattedLines.splice(1, 0, headerSeparator);
    }

    return formattedLines.join('\n');
  }

  private formatAsText(text: string): string {
    return text
      .replace(/\n\s*\n/g, '\n\n')
      .replace(/\n(?!\n)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private fixCommonOcrErrors(text: string): string {
    return text
      .replace(/([A-Z])([a-z])/g, '$1$2')
      .replace(/([0-9])([A-Z])/g, '$1 $2')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/A([aeiou])/g, 'Á$1')
      .replace(/[I1]([0-9])/g, 'I$1')
      .replace(/O([0-9])/g, '0$1')
      .replace(/([0-9])O/g, '$10')
      .replace(/([0-9])I/g, '$11')
      .replace(/\s+/g, ' ')
      .trim();
  }



  getSupportedLanguages(): string[] {
    return [
      'afr', 'amh', 'ara', 'asm', 'aze', 'aze_cyrl', 'bel', 'ben', 'bod',
      'bos', 'bre', 'bul', 'cat', 'ceb', 'ces', 'chi_sim', 'chi_tra', 'chr',
      'cos', 'cym', 'dan', 'deu', 'div', 'dzo', 'ell', 'eng', 'enm', 'epo',
      'est', 'eus', 'fao', 'fas', 'fil', 'fin', 'fra', 'frk', 'frm', 'fry',
      'gla', 'gle', 'glg', 'grc', 'guj', 'hat', 'heb', 'hin', 'hrv', 'hun',
      'hye', 'iku', 'ind', 'isl', 'ita', 'ita_old', 'jav', 'jpn', 'kan',
      'kat', 'kat_old', 'kaz', 'khm', 'kir', 'kor', 'lao', 'lat', 'lav',
      'lit', 'ltz', 'mal', 'mar', 'mkd', 'mlt', 'mon', 'mri', 'msa', 'mya',
      'nep', 'nld', 'nor', 'oci', 'ori', 'pan', 'pol', 'por', 'pus', 'que',
      'ron', 'rus', 'san', 'sin', 'slk', 'slv', 'snd', 'spa', 'spa_old',
      'sqi', 'srp', 'srp_latn', 'sun', 'swa', 'swe', 'syr', 'tam', 'tat',
      'tel', 'tgk', 'tha', 'tir', 'ton', 'tur', 'uig', 'ukr', 'urd', 'uzb',
      'uzb_cyrl', 'vie', 'yid', 'yor'
    ];
  }
}