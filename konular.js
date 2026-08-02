/* ============================================================
   Aksiyom — konular.js
   ------------------------------------------------------------
   Müfredat kataloğu. TYT / AYT / KPSS derslerinin konuları
   ünite başlıkları altında toplanır. Ders takibi modülü bu
   listeyi okur; kullanıcı verisi burada tutulmaz.

   Yapı:
     YKS.Curriculum.byType[tur] = [
       {
         subject: "matematik",        → YKS.Subjects ile aynı kimlik
         name:    "Matematik",
         icon:    "fa-calculator",
         groups: [
           { name: "Sayılar ve Cebir", topics: ["Temel Kavramlar", ...] }
         ]
       }
     ]

   Konu anahtarı konu adından üretilir (topicKey). Böylece
   listedeki sıra değişse bile kullanıcının kaydı bozulmaz;
   yalnızca konu adı değiştirilirse yeni kayıt açılır.

   Müfredat güncellendiğinde tek dokunulacak yer bu dosyadır.
   ============================================================ */

(function (window) {
  "use strict";

  var YKS = (window.YKS = window.YKS || {});

  YKS.Curriculum = {
    /* Katalog sürümü — müfredat değişince artırılır */
    version: "2026",

    byType: {

      /* ======================================================
         TYT — Temel Yeterlilik Testi
         ====================================================== */
      tyt: [
        {
          subject: "turkce",
          name: "Türkçe",
          icon: "fa-book",
          groups: [
            {
              name: "Anlam Bilgisi",
              topics: [
                "Sözcükte Anlam",
                "Söz Yorumu ve Deyim-Atasözü",
                "Cümlede Anlam",
                "Cümle Yorumu"
              ]
            },
            {
              name: "Paragraf",
              topics: [
                "Paragrafta Anlatım Teknikleri",
                "Paragrafta Düşünceyi Geliştirme Yolları",
                "Paragrafta Yapı",
                "Paragrafta Konu - Ana Düşünce",
                "Paragrafta Yardımcı Düşünce"
              ]
            },
            {
              name: "Dil Bilgisi",
              topics: [
                "Ses Bilgisi",
                "Yazım Kuralları",
                "Noktalama İşaretleri",
                "Sözcükte Yapı ve Ekler",
                "Sözcük Türleri: İsimler",
                "Sözcük Türleri: Zamirler",
                "Sözcük Türleri: Sıfatlar",
                "Sözcük Türleri: Zarflar",
                "Edat - Bağlaç - Ünlem",
                "Fiilde Anlam (Kip ve Kişi)",
                "Ek Fiil",
                "Fiilimsi",
                "Fiilde Çatı",
                "İsim ve Sıfat Tamlamaları",
                "Cümlenin Ögeleri",
                "Cümle Türleri",
                "Anlatım Bozuklukları"
              ]
            }
          ]
        },

        {
          subject: "matematik",
          name: "Matematik",
          icon: "fa-calculator",
          groups: [
            {
              name: "Sayılar ve Cebir",
              topics: [
                "Temel Kavramlar",
                "Sayı Basamakları",
                "Bölme ve Bölünebilme Kuralları",
                "EBOB - EKOK",
                "Rasyonel Sayılar",
                "Basit Eşitsizlikler",
                "Mutlak Değer",
                "Üslü Sayılar",
                "Köklü Sayılar",
                "Çarpanlara Ayırma",
                "Oran - Orantı",
                "Denklem Çözme"
              ]
            },
            {
              name: "Problemler",
              topics: [
                "Sayı Problemleri",
                "Kesir Problemleri",
                "Yaş Problemleri",
                "İşçi - Havuz Problemleri",
                "Hareket - Hız Problemleri",
                "Yüzde - Kâr - Zarar Problemleri",
                "Karışım Problemleri",
                "Grafik Problemleri",
                "Rutin Olmayan Problemler"
              ]
            },
            {
              name: "Cebir ve Analiz",
              topics: [
                "Kümeler",
                "Mantık",
                "Fonksiyonlar",
                "Polinomlar",
                "2. Dereceden Denklemler"
              ]
            },
            {
              name: "Veri, Sayma ve Olasılık",
              topics: [
                "Permütasyon",
                "Kombinasyon",
                "Binom ve Olasılık",
                "Veri - İstatistik"
              ]
            },
            {
              name: "Geometri: Üçgenler",
              topics: [
                "Doğruda ve Üçgende Açılar",
                "Dik Üçgen ve Öklid Bağıntıları",
                "İkizkenar ve Eşkenar Üçgen",
                "Üçgende Alan",
                "Üçgende Benzerlik",
                "Açıortay - Kenarortay",
                "Üçgende Açı - Kenar Bağıntıları"
              ]
            },
            {
              name: "Geometri: Çokgen ve Dörtgenler",
              topics: [
                "Çokgenler",
                "Dörtgenler",
                "Paralelkenar",
                "Eşkenar Dörtgen",
                "Dikdörtgen - Kare",
                "Yamuk",
                "Deltoid"
              ]
            },
            {
              name: "Geometri: Çember ve Katı Cisimler",
              topics: [
                "Çemberde Açı",
                "Çemberde Uzunluk",
                "Dairede Alan",
                "Prizmalar",
                "Piramit - Koni - Küre",
                "Silindir"
              ]
            },
            {
              name: "Geometri: Analitik",
              topics: [
                "Noktanın Analitiği",
                "Doğrunun Analitiği",
                "Dönüşüm Geometrisi"
              ]
            }
          ]
        },

        {
          subject: "fizik",
          name: "Fizik",
          icon: "fa-atom",
          groups: [
            {
              name: "Giriş ve Madde",
              topics: [
                "Fizik Bilimine Giriş",
                "Madde ve Özellikleri",
                "Katı - Sıvı - Gaz Basıncı",
                "Kaldırma Kuvveti"
              ]
            },
            {
              name: "Isı ve Hareket",
              topics: [
                "Isı, Sıcaklık ve Genleşme",
                "Hareket ve Kuvvet",
                "Newton'ın Hareket Yasaları",
                "İş, Güç ve Enerji"
              ]
            },
            {
              name: "Elektrik ve Manyetizma",
              topics: [
                "Elektrostatik",
                "Elektrik Akımı ve Devreler",
                "Mıknatıs ve Manyetik Alan"
              ]
            },
            {
              name: "Dalgalar ve Optik",
              topics: [
                "Dalgalar",
                "Aydınlanma ve Gölge",
                "Düzlem Ayna - Küresel Ayna",
                "Kırılma ve Mercekler"
              ]
            }
          ]
        },

        {
          subject: "kimya",
          name: "Kimya",
          icon: "fa-vial",
          groups: [
            {
              name: "Temel Kimya",
              topics: [
                "Kimya Bilimi",
                "Atom ve Periyodik Sistem",
                "Kimyasal Türler Arası Etkileşimler",
                "Maddenin Halleri"
              ]
            },
            {
              name: "Hesaplamalar ve Karışımlar",
              topics: [
                "Kimyanın Temel Kanunları",
                "Mol Kavramı ve Kimyasal Hesaplamalar",
                "Karışımlar",
                "Ayırma ve Saflaştırma Teknikleri"
              ]
            },
            {
              name: "Günlük Hayat Kimyası",
              topics: [
                "Asitler, Bazlar ve Tuzlar",
                "Doğa ve Kimya",
                "Kimya Her Yerde"
              ]
            }
          ]
        },

        {
          subject: "biyoloji",
          name: "Biyoloji",
          icon: "fa-dna",
          groups: [
            {
              name: "Hücre ve Canlılar",
              topics: [
                "Canlıların Ortak Özellikleri",
                "Canlıların Temel Bileşenleri",
                "Hücre ve Organeller",
                "Hücre Zarından Madde Geçişi",
                "Canlıların Sınıflandırılması"
              ]
            },
            {
              name: "Üreme ve Kalıtım",
              topics: [
                "Mitoz ve Eşeysiz Üreme",
                "Mayoz ve Eşeyli Üreme",
                "Kalıtımın Genel İlkeleri"
              ]
            },
            {
              name: "Ekoloji",
              topics: [
                "Ekosistem Ekolojisi",
                "Madde Döngüleri",
                "Güncel Çevre Sorunları"
              ]
            }
          ]
        },

        {
          subject: "tarih",
          name: "Tarih",
          icon: "fa-landmark",
          groups: [
            {
              name: "İlk ve Orta Çağ",
              topics: [
                "Tarih ve Zaman",
                "İnsanlığın İlk Dönemleri",
                "Orta Çağ'da Dünya",
                "İlk ve Orta Çağlarda Türk Dünyası",
                "İslam Medeniyetinin Doğuşu",
                "Türklerin İslamiyet'i Kabulü"
              ]
            },
            {
              name: "Osmanlı Tarihi",
              topics: [
                "Yerleşme ve Devletleşme Sürecinde Selçuklu Türkiyesi",
                "Beylikten Devlete Osmanlı (1302-1453)",
                "Dünya Gücü Osmanlı (1453-1595)",
                "Yeni Çağ Avrupası",
                "Değişim Çağında Avrupa ve Osmanlı",
                "Uluslararası İlişkilerde Denge Stratejisi (1774-1914)"
              ]
            },
            {
              name: "Yakın Çağ ve Cumhuriyet",
              topics: [
                "Devrimler Çağında Değişen Devlet-Toplum İlişkileri",
                "Sermaye ve Emek",
                "XIX. ve XX. Yüzyılda Değişen Gündelik Hayat",
                "XX. Yüzyıl Başlarında Osmanlı ve Savaşlar",
                "Milli Mücadele",
                "Atatürkçülük ve Türk İnkılabı"
              ]
            }
          ]
        },

        {
          subject: "cografya",
          name: "Coğrafya",
          icon: "fa-map",
          groups: [
            {
              name: "Doğal Sistemler",
              topics: [
                "Doğa ve İnsan",
                "Dünya'nın Şekli ve Hareketleri",
                "Coğrafi Konum",
                "Harita Bilgisi",
                "Atmosfer ve Sıcaklık",
                "İklimler",
                "Basınç ve Rüzgârlar",
                "Nem ve Yağış",
                "İç Kuvvetler - Dış Kuvvetler",
                "Su, Toprak ve Bitki Örtüsü"
              ]
            },
            {
              name: "Beşeri Sistemler",
              topics: [
                "Nüfus",
                "Göç",
                "Yerleşme",
                "Ekonomik Faaliyetler",
                "Bölgeler ve Ülkeler"
              ]
            },
            {
              name: "Türkiye ve Çevre",
              topics: [
                "Türkiye'nin Yer Şekilleri",
                "Türkiye'nin İklimi",
                "Türkiye'de Nüfus ve Yerleşme",
                "Doğal Afetler",
                "Çevre ve Toplum"
              ]
            }
          ]
        },

        {
          subject: "felsefe",
          name: "Felsefe",
          icon: "fa-brain",
          groups: [
            {
              name: "Felsefeye Giriş",
              topics: [
                "Felsefeyi Tanıma",
                "Felsefe ile Düşünme",
                "Felsefenin Alanları"
              ]
            },
            {
              name: "Felsefenin Konuları",
              topics: [
                "Bilgi Felsefesi",
                "Varlık Felsefesi",
                "Ahlak Felsefesi",
                "Sanat Felsefesi",
                "Din Felsefesi",
                "Siyaset Felsefesi",
                "Bilim Felsefesi"
              ]
            },
            {
              name: "Felsefe Tarihi",
              topics: [
                "İlk Çağ Felsefesi",
                "MS 2. Yüzyıl - MS 15. Yüzyıl Felsefesi",
                "15. Yüzyıl - 17. Yüzyıl Felsefesi",
                "18. Yüzyıl - 19. Yüzyıl Felsefesi",
                "20. Yüzyıl Felsefesi"
              ]
            }
          ]
        },

        {
          subject: "din",
          name: "Din Kültürü ve Ahlak Bilgisi",
          icon: "fa-mosque",
          groups: [
            {
              name: "İnanç ve İbadet",
              topics: [
                "Bilgi ve İnanç",
                "İslam ve İbadet",
                "Ahlak ve Değerler",
                "Vahiy ve Akıl"
              ]
            },
            {
              name: "Kültür ve Medeniyet",
              topics: [
                "Din, Kültür ve Medeniyet",
                "İslam Düşüncesinde Yorumlar ve Mezhepler",
                "Hz. Muhammed (S.A.V.)",
                "Din ve Hayat",
                "Yaşayan Dinler"
              ]
            }
          ]
        }
      ],

      /* ======================================================
         AYT — Alan Yeterlilik Testi
         ====================================================== */
      ayt: [
        {
          subject: "matematik",
          name: "Matematik",
          icon: "fa-calculator",
          groups: [
            {
              name: "Fonksiyon ve Cebir",
              topics: [
                "Fonksiyonlar (İleri)",
                "Polinomlar",
                "2. Dereceden Denklemler",
                "2. Dereceden Eşitsizlikler",
                "Parabol",
                "Karmaşık Sayılar",
                "Logaritma"
              ]
            },
            {
              name: "Trigonometri ve Diziler",
              topics: [
                "Trigonometrik Fonksiyonlar",
                "Toplam - Fark ve İki Kat Açı Formülleri",
                "Trigonometrik Denklemler",
                "Diziler",
                "Seriler"
              ]
            },
            {
              name: "Analiz",
              topics: [
                "Limit ve Süreklilik",
                "Türev",
                "Türev Uygulamaları (Maksimum-Minimum)",
                "İntegral",
                "İntegral Uygulamaları (Alan-Hacim)"
              ]
            },
            {
              name: "Sayma ve Olasılık",
              topics: [
                "Permütasyon - Kombinasyon",
                "Binom Açılımı",
                "Olasılık",
                "Koşullu Olasılık"
              ]
            },
            {
              name: "Geometri",
              topics: [
                "Üçgenlerde Trigonometrik Bağıntılar",
                "Dörtgenler ve Çokgenler (İleri)",
                "Çember ve Daire (İleri)",
                "Katı Cisimler (İleri)",
                "Doğrunun Analitiği (İleri)",
                "Çemberin Analitiği",
                "Dönüşüm Geometrisi",
                "Uzay Geometri"
              ]
            }
          ]
        },

        {
          subject: "fizik",
          name: "Fizik",
          icon: "fa-atom",
          groups: [
            {
              name: "Kuvvet ve Hareket",
              topics: [
                "Vektörler",
                "Bağıl Hareket",
                "Newton'ın Hareket Yasaları",
                "Bir Boyutta Sabit İvmeli Hareket",
                "İki Boyutta Hareket (Atışlar)",
                "Enerji ve Hareket",
                "İtme ve Çizgisel Momentum",
                "Tork ve Denge",
                "Basit Makineler"
              ]
            },
            {
              name: "Elektrik ve Manyetizma",
              topics: [
                "Elektriksel Kuvvet ve Elektrik Alan",
                "Elektriksel Potansiyel",
                "Düzgün Elektrik Alan ve Sığa",
                "Manyetik Alan ve Manyetik Kuvvet",
                "İndüksiyon ve Alternatif Akım",
                "Transformatörler"
              ]
            },
            {
              name: "Çembersel Hareket ve Dalgalar",
              topics: [
                "Düzgün Çembersel Hareket",
                "Dönerek Öteleme Hareketi",
                "Açısal Momentum",
                "Kütle Çekim ve Kepler Yasaları",
                "Basit Harmonik Hareket",
                "Dalga Mekaniği",
                "Su Dalgaları ve Girişim",
                "Ses Dalgaları",
                "Deprem Dalgaları"
              ]
            },
            {
              name: "Modern Fizik",
              topics: [
                "Atom Fiziğine Giriş ve Radyoaktivite",
                "Özel Görelilik",
                "Kara Cisim Işıması",
                "Fotoelektrik Olay ve Compton Olayı",
                "Modern Fiziğin Teknolojideki Uygulamaları"
              ]
            }
          ]
        },

        {
          subject: "kimya",
          name: "Kimya",
          icon: "fa-vial",
          groups: [
            {
              name: "Atom ve Gazlar",
              topics: [
                "Modern Atom Teorisi",
                "Periyodik Özellikler ve Bağlar",
                "Gazlar",
                "Sıvı Çözeltiler ve Çözünürlük"
              ]
            },
            {
              name: "Enerji, Hız ve Denge",
              topics: [
                "Kimyasal Tepkimelerde Enerji",
                "Kimyasal Tepkimelerde Hız",
                "Kimyasal Tepkimelerde Denge",
                "Asit - Baz Dengesi",
                "Çözünürlük Dengesi",
                "Kimya ve Elektrik"
              ]
            },
            {
              name: "Organik Kimya",
              topics: [
                "Karbon Kimyasına Giriş",
                "Hidrokarbonlar",
                "Alkoller, Eterler ve Karbonil Bileşikleri",
                "Karboksilik Asitler ve Esterler",
                "Enerji Kaynakları ve Bilimsel Gelişmeler"
              ]
            }
          ]
        },

        {
          subject: "biyoloji",
          name: "Biyoloji",
          icon: "fa-dna",
          groups: [
            {
              name: "Denetim ve Düzenleme",
              topics: [
                "Sinir Sistemi",
                "Endokrin Sistem ve Hormonlar",
                "Duyu Organları",
                "Destek ve Hareket Sistemi"
              ]
            },
            {
              name: "Sistemler",
              topics: [
                "Sindirim Sistemi",
                "Dolaşım ve Bağışıklık Sistemi",
                "Solunum Sistemi",
                "Üriner Sistem (Boşaltım)",
                "Üreme Sistemi ve Embriyonik Gelişim"
              ]
            },
            {
              name: "Genetik ve Enerji",
              topics: [
                "Genden Proteine (Nükleik Asitler)",
                "Protein Sentezi",
                "Genetik Mühendisliği ve Biyoteknoloji",
                "Canlılarda Enerji Dönüşümleri",
                "Fotosentez",
                "Kemosentez",
                "Hücresel Solunum"
              ]
            },
            {
              name: "Bitki ve Ekoloji",
              topics: [
                "Bitkisel Dokular",
                "Bitkilerde Taşıma ve Beslenme",
                "Bitkilerde Eşeyli Üreme",
                "Komünite Ekolojisi",
                "Popülasyon Ekolojisi"
              ]
            }
          ]
        },

        {
          subject: "edebiyat",
          name: "Türk Dili ve Edebiyatı",
          icon: "fa-book-open",
          groups: [
            {
              name: "Edebiyat Bilgileri",
              topics: [
                "Güzel Sanatlar ve Edebiyat",
                "Şiir Bilgisi ve Ölçü",
                "Söz Sanatları",
                "Edebi Akımlar",
                "Metin Türleri: Öğretici Metinler",
                "Metin Türleri: Anlatmaya Bağlı Metinler",
                "Metin Türleri: Göstermeye Bağlı Metinler"
              ]
            },
            {
              name: "İslamiyet Öncesi ve Halk Edebiyatı",
              topics: [
                "İslamiyet Öncesi Türk Edebiyatı",
                "Geçiş Dönemi Eserleri",
                "Anonim Halk Edebiyatı",
                "Âşık Tarzı Halk Edebiyatı",
                "Dini - Tasavvufi Halk Edebiyatı"
              ]
            },
            {
              name: "Divan Edebiyatı",
              topics: [
                "Divan Edebiyatı Nazım Biçimleri",
                "Divan Edebiyatı Nazım Türleri",
                "Divan Edebiyatı Sanatçıları",
                "Divan Edebiyatı Nesir"
              ]
            },
            {
              name: "Yeni Türk Edebiyatı",
              topics: [
                "Tanzimat Edebiyatı I. Dönem",
                "Tanzimat Edebiyatı II. Dönem",
                "Servet-i Fünun Edebiyatı",
                "Fecr-i Ati Edebiyatı",
                "Milli Edebiyat",
                "Cumhuriyet Dönemi Şiiri",
                "Cumhuriyet Dönemi Roman ve Hikâye",
                "Cumhuriyet Dönemi Tiyatro",
                "Batı Edebiyatı ve Dünya Edebiyatı"
              ]
            }
          ]
        },

        {
          subject: "tarih1",
          name: "Tarih-1",
          icon: "fa-landmark",
          groups: [
            {
              name: "İlk Çağ ve Türk Dünyası",
              topics: [
                "Tarih ve Zaman",
                "İnsanlığın İlk Dönemleri",
                "Orta Çağ'da Dünya",
                "İlk ve Orta Çağlarda Türk Dünyası",
                "İslam Medeniyetinin Doğuşu",
                "Türklerin İslamiyet'i Kabulü"
              ]
            },
            {
              name: "Osmanlı'nın Yükselişi",
              topics: [
                "Selçuklu Türkiyesi",
                "Beylikten Devlete Osmanlı (1302-1453)",
                "Dünya Gücü Osmanlı (1453-1595)"
              ]
            }
          ]
        },

        {
          subject: "cografya1",
          name: "Coğrafya-1",
          icon: "fa-map",
          groups: [
            {
              name: "Doğal Sistemler",
              topics: [
                "Ekosistem ve Madde Döngüsü",
                "Biyoçeşitlilik",
                "Nüfus Politikaları",
                "Şehirleşme ve Şehir Türleri",
                "Ekonomik Faaliyetlerin Sınıflandırılması"
              ]
            },
            {
              name: "Türkiye Coğrafyası",
              topics: [
                "Türkiye'de Yer Şekilleri ve Oluşum Süreçleri",
                "Türkiye'nin İklimi ve Bitki Örtüsü",
                "Türkiye'de Nüfus ve Yerleşme",
                "Türkiye Ekonomisi ve Sektörler"
              ]
            }
          ]
        },

        {
          subject: "tarih2",
          name: "Tarih-2",
          icon: "fa-landmark",
          groups: [
            {
              name: "Değişim ve Yenileşme",
              topics: [
                "Yeni Çağ Avrupası",
                "Değişim Çağında Avrupa ve Osmanlı",
                "Uluslararası İlişkilerde Denge Stratejisi (1774-1914)",
                "Devrimler Çağında Değişen Devlet-Toplum İlişkileri",
                "Sermaye ve Emek"
              ]
            },
            {
              name: "Milli Mücadele ve Cumhuriyet",
              topics: [
                "XX. Yüzyıl Başlarında Osmanlı Devleti",
                "I. Dünya Savaşı ve Cepheler",
                "Milli Mücadele Hazırlık Dönemi",
                "Kurtuluş Savaşı Cepheleri",
                "Türk İnkılabı",
                "Atatürk İlkeleri",
                "Atatürk Dönemi İç ve Dış Politika",
                "II. Dünya Savaşı ve Sonrası Türkiye",
                "Çağdaş Türk ve Dünya Tarihi"
              ]
            }
          ]
        },

        {
          subject: "cografya2",
          name: "Coğrafya-2",
          icon: "fa-map",
          groups: [
            {
              name: "Küresel Ortam",
              topics: [
                "Bölgeler ve Ülkeler",
                "Küresel Ticaret ve Ulaşım Ağları",
                "Doğal Kaynaklar ve Enerji",
                "Çevre Sorunları ve Yönetimi",
                "Doğal Afetler ve Toplum"
              ]
            },
            {
              name: "Türkiye ve Dünya",
              topics: [
                "Türkiye'nin Jeopolitik Konumu",
                "Türkiye'nin Ulaşım Politikaları",
                "Türkiye'de Turizm",
                "Uluslararası Kuruluşlar"
              ]
            }
          ]
        },

        {
          subject: "felsefe",
          name: "Felsefe",
          icon: "fa-brain",
          groups: [
            {
              name: "Felsefe Alanları",
              topics: [
                "Bilgi Felsefesi",
                "Varlık Felsefesi",
                "Ahlak Felsefesi",
                "Sanat Felsefesi",
                "Din Felsefesi",
                "Siyaset Felsefesi",
                "Bilim Felsefesi"
              ]
            }
          ]
        },

        {
          subject: "psikoloji",
          name: "Psikoloji",
          icon: "fa-user-doctor",
          groups: [
            {
              name: "Psikoloji Bilimi",
              topics: [
                "Psikoloji Bilimini Tanıyalım",
                "Psikolojinin Temel Süreçleri",
                "Öğrenme, Bellek ve Düşünme",
                "Ruh Sağlığının Temelleri"
              ]
            }
          ]
        },

        {
          subject: "sosyoloji",
          name: "Sosyoloji",
          icon: "fa-people-group",
          groups: [
            {
              name: "Toplum ve Kurumlar",
              topics: [
                "Sosyolojiye Giriş",
                "Birey ve Toplum",
                "Toplumsal Yapı ve Değişme",
                "Toplumsal Kurumlar (Aile, Din, Eğitim, Ekonomi, Siyaset)"
              ]
            }
          ]
        },

        {
          subject: "mantik",
          name: "Mantık",
          icon: "fa-diagram-project",
          groups: [
            {
              name: "Mantığın Temelleri",
              topics: [
                "Mantığa Giriş",
                "Klasik Mantık ve Kavram",
                "Önermeler ve Çıkarım",
                "Sembolik Mantık"
              ]
            }
          ]
        },

        {
          subject: "din",
          name: "Din Kültürü ve Ahlak Bilgisi",
          icon: "fa-mosque",
          groups: [
            {
              name: "İnanç ve Hayat",
              topics: [
                "Dünya ve Ahiret",
                "Kur'an'a Göre Hz. Muhammed",
                "Kur'an'da Bazı Kavramlar",
                "İnançla İlgili Meseleler",
                "Yahudilik ve Hristiyanlık",
                "İslam ve Bilim"
              ]
            }
          ]
        }
      ],

      /* ======================================================
         KPSS — Genel Yetenek / Genel Kültür (Lisans)
         ====================================================== */
      kpss: [
        {
          subject: "turkce",
          name: "Türkçe",
          icon: "fa-book",
          groups: [
            {
              name: "Anlam ve Paragraf",
              topics: [
                "Sözcükte Anlam",
                "Cümlede Anlam",
                "Paragrafta Anlam",
                "Paragrafta Yapı ve Akış"
              ]
            },
            {
              name: "Dil Bilgisi",
              topics: [
                "Ses Bilgisi",
                "Yazım Kuralları",
                "Noktalama İşaretleri",
                "Sözcükte Yapı",
                "Sözcük Türleri",
                "Fiiller, Fiilimsi ve Çatı",
                "Cümlenin Ögeleri",
                "Cümle Türleri",
                "Anlatım Bozuklukları"
              ]
            }
          ]
        },

        {
          subject: "matematik",
          name: "Matematik",
          icon: "fa-calculator",
          groups: [
            {
              name: "Sayılar ve Cebir",
              topics: [
                "Temel Kavramlar",
                "Sayı Basamakları",
                "Bölme ve Bölünebilme",
                "EBOB - EKOK",
                "Rasyonel Sayılar",
                "Basit Eşitsizlikler",
                "Mutlak Değer",
                "Üslü ve Köklü Sayılar",
                "Çarpanlara Ayırma",
                "Oran - Orantı",
                "Denklem Çözme"
              ]
            },
            {
              name: "Problemler",
              topics: [
                "Sayı ve Kesir Problemleri",
                "Yaş Problemleri",
                "İşçi - Havuz Problemleri",
                "Hareket Problemleri",
                "Yüzde - Kâr - Zarar",
                "Karışım Problemleri",
                "Grafik ve Tablo Problemleri"
              ]
            },
            {
              name: "Mantık ve Sayısal Akıl",
              topics: [
                "Kümeler",
                "Fonksiyonlar",
                "İşlem ve Modüler Aritmetik",
                "Permütasyon - Kombinasyon - Olasılık",
                "Sayı ve Şekil Örüntüleri",
                "Sözel Mantık Soruları"
              ]
            },
            {
              name: "Geometri",
              topics: [
                "Doğruda ve Üçgende Açılar",
                "Üçgende Alan ve Benzerlik",
                "Dörtgenler",
                "Çember ve Daire",
                "Katı Cisimler",
                "Analitik Geometri"
              ]
            }
          ]
        },

        {
          subject: "tarih",
          name: "Tarih",
          icon: "fa-landmark",
          groups: [
            {
              name: "Türk Tarihi",
              topics: [
                "İslamiyet Öncesi Türk Tarihi",
                "İlk Türk-İslam Devletleri",
                "Türkiye Selçuklu Devleti"
              ]
            },
            {
              name: "Osmanlı Tarihi",
              topics: [
                "Osmanlı Kuruluş Dönemi",
                "Osmanlı Yükselme Dönemi",
                "Osmanlı Duraklama Dönemi",
                "Osmanlı Gerileme Dönemi",
                "Osmanlı Dağılma Dönemi",
                "Osmanlı Kültür ve Medeniyeti"
              ]
            },
            {
              name: "Yakın Dönem",
              topics: [
                "XX. Yüzyıl Başlarında Osmanlı",
                "I. Dünya Savaşı",
                "Kurtuluş Savaşı Hazırlık Dönemi",
                "Kurtuluş Savaşı Cepheleri",
                "Türk İnkılabı",
                "Atatürk İlkeleri",
                "Atatürk Dönemi İç ve Dış Politika",
                "Çağdaş Türk ve Dünya Tarihi"
              ]
            }
          ]
        },

        {
          subject: "cografya",
          name: "Coğrafya",
          icon: "fa-map",
          groups: [
            {
              name: "Türkiye'nin Fiziki Coğrafyası",
              topics: [
                "Türkiye'nin Coğrafi Konumu",
                "Türkiye'nin Yer Şekilleri",
                "Türkiye'nin İklimi ve Bitki Örtüsü",
                "Türkiye'nin Su Varlıkları ve Toprakları"
              ]
            },
            {
              name: "Beşeri ve Ekonomik Coğrafya",
              topics: [
                "Türkiye'de Nüfus ve Yerleşme",
                "Türkiye'de Tarım ve Hayvancılık",
                "Türkiye'de Madenler ve Enerji Kaynakları",
                "Türkiye'de Sanayi",
                "Türkiye'de Ulaşım, Ticaret ve Turizm",
                "Türkiye'nin Coğrafi Bölgeleri"
              ]
            }
          ]
        },

        {
          subject: "vatandaslik",
          name: "Vatandaşlık",
          icon: "fa-flag",
          groups: [
            {
              name: "Hukukun Temelleri",
              topics: [
                "Hukuka Giriş ve Temel Kavramlar",
                "Devlet Biçimleri ve Hükümet Sistemleri",
                "Türk Anayasa Tarihi"
              ]
            },
            {
              name: "1982 Anayasası",
              topics: [
                "Anayasanın Temel İlkeleri",
                "Temel Hak ve Ödevler",
                "Yasama",
                "Yürütme",
                "Yargı",
                "İdare Hukuku ve İdari Teşkilat"
              ]
            },
            {
              name: "Güncel Bilgiler",
              topics: [
                "Uluslararası Kuruluşlar",
                "Güncel Olaylar ve Kurumlar"
              ]
            }
          ]
        }
      ]
    },

    /* ==========================================================
       YARDIMCILAR
       ========================================================== */

    /** Bir sınav türünün ders listesi */
    subjectsOf: function (type) {
      return this.byType[type] || [];
    },

    /** Tür + ders kimliğinden ders kaydı */
    find: function (type, subjectId) {
      var list = this.subjectsOf(type);
      for (var i = 0; i < list.length; i++) {
        if (list[i].subject === subjectId) return list[i];
      }
      return null;
    },

    /** Türkçe karakterleri sadeleştirip anahtar üretir */
    slug: function (text) {
      var map = { "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u", "â": "a", "î": "i", "û": "u" };

      return String(text || "")
        .toLocaleLowerCase("tr")
        .replace(/[çğıöşüâîû]/g, function (c) { return map[c] || c; })
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    },

    /**
     * Konunun kalıcı anahtarı. Kullanıcı kaydı bu anahtarla
     * tutulur; listedeki sıra değişse bile kayıt korunur.
     */
    topicKey: function (type, subjectId, topicName) {
      return type + "." + subjectId + "." + this.slug(topicName);
    },

    /** Bir dersteki konu sayısı */
    topicCountOf: function (type, subjectId) {
      var subject = this.find(type, subjectId);
      if (!subject) return 0;

      return subject.groups.reduce(function (sum, g) { return sum + g.topics.length; }, 0);
    },

    /** Bir sınav türündeki toplam konu sayısı */
    totalTopics: function (type) {
      var self = this;
      return this.subjectsOf(type).reduce(function (sum, s) {
        return sum + self.topicCountOf(type, s.subject);
      }, 0);
    },

    /** Tüm konuları düz liste hâlinde döndürür */
    flatTopics: function (type) {
      var self = this, out = [];

      this.subjectsOf(type).forEach(function (subject) {
        subject.groups.forEach(function (group) {
          group.topics.forEach(function (topic) {
            out.push({
              key: self.topicKey(type, subject.subject, topic),
              type: type,
              subjectId: subject.subject,
              subjectName: subject.name,
              subjectIcon: subject.icon,
              group: group.name,
              name: topic
            });
          });
        });
      });

      return out;
    }
  };

})(window);
