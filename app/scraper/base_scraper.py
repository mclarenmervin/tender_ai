from abc import ABC,abstractmethod
class BaseScraper(ABC):
    source_name='base'
    @abstractmethod
    def scrape(self): raise NotImplementedError
